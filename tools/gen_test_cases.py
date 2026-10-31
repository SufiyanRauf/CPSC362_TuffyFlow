"""Generate TEST_CASES.md from the test files and from a real run.

The professor asked for test cases in the project. Writing them out by hand
would mean a document that drifts from the suite the moment anybody adds a
test, so this builds the document instead:

    python3 tools/gen_test_cases.py

Where each column comes from, so nothing in the document is invented:

  ID               the suite's prefix and the test's position in its file
  Precondition     the fixture call the test sets up with, or for the rules
                   suite the describe() subject the test sits under
  What it checks    the test's own name, with the underscores taken out
  Expected result  the test's assert conditions, printed back from the parsed
                   source rather than described
  Result           pass or fail from running the suite, with the date

Every suite has to run. If one cannot, this stops rather than writing a
document that claims a pass it did not see.
"""
import ast
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV = os.path.join(ROOT, '.venv', 'bin', 'python')

# How many assert conditions to print before saying how many there are. Four
# is about as much as a table cell carries before it stops being readable.
SHOWN = 4

SUITES = [
    dict(prefix='SC', title='Ranking engine', file='tests/test_scoring.py',
         kind='py', command='.venv/bin/python -m pytest tests/test_scoring.py',
         covers='Parking, Campus spots, Events',
         note='Pure functions over dicts. No web framework and no database, '
              'so these run in about half a second.'),
    dict(prefix='API', title='Scoring endpoint', file='tests/test_api.py',
         kind='py', command='.venv/bin/python -m pytest tests/test_api.py',
         covers='Parking, Campus spots and Events, through the HTTP layer',
         note='These go through the FastAPI app rather than calling the '
              'handler, so the request model and the error handler are in '
              'the test too.'),
    dict(prefix='SEC', title='Security rules', file='tests/firestore_rules.test.mjs',
         kind='rules', command='npm run test:rules',
         covers='Student profile, Weekly schedule, and read-only access to the campus',
         note='Run against Firebase\'s Firestore emulator on this machine. '
              'Nothing in this suite touches the real project. Needs '
              'firebase-tools and a JDK on the path, and a passing run '
              'prints a wall of red PERMISSION_DENIED lines, because every '
              'case here is a refusal that is supposed to happen.'),
    dict(prefix='DATE', title='Event dating', file='tests/event_dates.test.mjs',
         kind='node', command='npm run test:dates',
         covers='Club and event matching',
         note='The daylight saving arithmetic, which is the part of the '
              'event screen that has no second chance to be right.'),
    dict(prefix='CLK', title='Clock formatting', file='tests/clock_text.test.mjs',
         kind='node', command='npm run test:dates',
         covers='The screens that read a stored time through src/lib/time.ts',
         note='time.ts turns a stored time into something a student reads, and '
              'six screens go through it, so one broken branch here is wrong on '
              'all six at once. The two event screens format their own dates '
              'with Intl directly and are covered by Event dating instead.'),
    dict(prefix='CLUB', title='Club ranking', file='tests/club_ranking.test.mjs',
         kind='node', command='npm run test:clubs',
         covers='Club matching',
         note='The order the club list comes out in, which is the whole '
              'point of that screen and the one thing on it worth testing.'),
]


def humanise(name):
    """A test name as a sentence.

    The first letter goes up, except when the first word is a camelCase
    identifier: capitalising clockText gave ClockText, which is not the name
    of anything, and a grader searching the codebase for it finds nothing.
    """
    text = re.sub(r'^test_', '', name).replace('_', ' ')
    first = text.split(' ')[0]
    if first[1:] != first[1:].lower():
        return text
    return text[:1].upper() + text[1:]


def py_cases(path):
    """Every test in a pytest file, in the order pytest runs them."""
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        tree = ast.parse(f.read())
    out = []
    for node in tree.body:
        if not (isinstance(node, ast.FunctionDef) and node.name.startswith('test_')):
            continue

        # The fixture the test builds its world with. Module level helpers in
        # these files are all named with a leading underscore.
        setup = ''
        for sub in ast.walk(node):
            if (isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name)
                    and sub.func.id.startswith('_')):
                setup = ast.unparse(sub)
                break

        # A refusal test states its expectation by NOT raising: it calls the
        # thing with a bad value, swallows the exception it wants, and raises
        # only if the value was accepted. There is no assert to read, so the
        # shape has to be described. Printing the AssertionError instead would
        # state the failure condition as the expectation, which is backwards,
        # and reading only the asserts left behind showed the values that are
        # accepted under a heading saying the bad ones are refused.
        #
        # Two shapes: one value, or a loop over several.
        refusals = []
        for sub in ast.walk(node):
            if not isinstance(sub, ast.Try):
                continue
            # the handler has to be the passing path, not real handling
            if not all(len(h.body) == 1
                       and isinstance(h.body[0], (ast.Return, ast.Continue))
                       for h in sub.handlers):
                continue
            caught = ' or '.join(ast.unparse(h.type) for h in sub.handlers
                                 if h.type is not None) or 'an exception'
            called = '; '.join(ast.unparse(st) for st in sub.body)
            loop = next((f for f in ast.walk(node)
                         if isinstance(f, ast.For) and sub in ast.walk(f)), None)
            if loop is not None:
                refusals.append('%s raises %s for every value in %s'
                                % (called, caught, ast.unparse(loop.iter)))
            else:
                refusals.append('%s raises %s' % (called, caught))

        expected = refusals + [ast.unparse(s.test) for s in ast.walk(node)
                               if isinstance(s, ast.Assert)]

        out.append(dict(key=node.name, checks=humanise(node.name),
                        setup=setup, expected=expected))
    return out


# describe('subject', () => {   and   it('name', async () => {
DESCRIBE = re.compile(r"^\s*describe\(\s*(['\"])(.+?)\1")
ITEM = re.compile(r"^\s*(?:it|test)\(\s*(['\"])(.+?)\1")
# await assertFails(...) / assertSucceeds(...) / assert.equal(...)
EXPECT = re.compile(r'\b(assertFails|assertSucceeds|assert\.\w+)\(')


def balance(line):
    """How far this line opens brackets without closing them."""
    return sum(line.count(c) for c in '([{') - sum(line.count(c) for c in ')]}')


def node_cases(path):
    """Every test in a node --test file, with its describe() subject.

    The subject matters: without it the rules suite prints "Cannot read the
    campus" and "Can read the campus" three rows apart with nothing saying
    that the first is a logged out visitor and the second is a student.
    """
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        lines = f.read().split('\n')

    out = []
    subject = ''
    depth_of_subject = None
    depth = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        found = DESCRIBE.match(line)
        if found:
            subject = found.group(2)
            depth_of_subject = depth
        item = ITEM.match(line)
        if item:
            # the body of this test, to the line whose closing brace returns
            # to the depth the test opened at
            start_depth = depth + line.count('{') - line.count('}')
            body = []
            j = i + 1
            d = start_depth
            while j < len(lines) and d > depth:
                body.append(lines[j])
                d += lines[j].count('{') - lines[j].count('}')
                j += 1
            # A call spread over several lines has to be gathered to its
            # closing bracket, or the cell ends on "{" and loses the fields
            # the test is actually about.
            expected = []
            k = 0
            while k < len(body):
                if not EXPECT.search(body[k]):
                    k += 1
                    continue
                text = body[k].strip()
                depth = balance(text)
                while depth > 0 and k + 1 < len(body):
                    k += 1
                    text += ' ' + body[k].strip()
                    depth += balance(body[k])
                if text.startswith('await '):
                    text = text[6:]
                expected.append(re.sub(r'\s+', ' ', text).rstrip(',;'))
                k += 1
            out.append(dict(key=item.group(2), checks=humanise(item.group(2)),
                            setup=subject, expected=expected))
        depth += line.count('{') - line.count('}')
        if depth_of_subject is not None and depth <= depth_of_subject:
            subject = ''
            depth_of_subject = None
        i += 1
    return out


def junit(path):
    """Pass, fail or skipped per test name, from a JUnit report.

    Skipped is reported rather than folded into a pass. A skipped test that
    printed as Pass would keep the "all passing" line on the front page while
    nothing had actually run, which is the one lie this document must not be
    able to tell.
    """
    tree = ET.parse(path)
    out = {}
    for case in tree.iter('testcase'):
        name = case.get('name')
        if name in out:
            raise SystemExit(
                'two tests are both called "%s" in %s. Their results cannot '
                'be told apart, so the document would be guessing.'
                % (name, path))
        if case.find('failure') is not None or case.find('error') is not None:
            out[name] = 'Fail'
        elif case.find('skipped') is not None:
            out[name] = 'Skipped'
        else:
            out[name] = 'Pass'
    return out


def run(suite):
    """Run one suite and hand back its per-test results."""
    report = tempfile.NamedTemporaryFile(suffix='.xml', delete=False).name
    env = dict(os.environ)
    # the emulator needs a JDK and Homebrew does not put this one on the path
    env['PATH'] = '/opt/homebrew/opt/openjdk/bin:' + env['PATH']

    if suite['kind'] == 'py':
        cmd = [VENV, '-m', 'pytest', suite['file'], '-q',
               '--junitxml=' + report]
    else:
        inner = ('node --test --test-reporter=junit '
                 '--test-reporter-destination=%s %s' % (report, suite['file']))
        if suite['kind'] == 'rules':
            cmd = ['npx', 'firebase', 'emulators:exec', '--only', 'firestore',
                   '--project', 'demo-tuffyflow', inner]
        else:
            cmd = inner.split()

    # The emulator needs a port nobody is on. 8080 is what firebase.json
    # says, and a run left over from earlier can still be sitting on it, so
    # the port is picked here and handed over in a config of its own.
    spare = None
    if suite['kind'] == 'rules':
        import socket
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        env['FIRESTORE_EMULATOR_PORT'] = str(port)
        spare = os.path.join(ROOT, '.firebase.generated.json')
        with open(spare, 'w', encoding='utf-8') as f:
            f.write(
                '{"firestore": {"rules": "db/firestore.rules"},'
                ' "emulators": {"firestore": {"port": %d},'
                ' "ui": {"enabled": false}}}' % port)
        at = cmd.index('emulators:exec')
        cmd = cmd[:at] + ['--config', spare] + cmd[at:]

    try:
        done = subprocess.run(cmd, cwd=ROOT, env=env,
                              capture_output=True, text=True)
    finally:
        if spare and os.path.exists(spare):
            os.unlink(spare)
    if not os.path.exists(report) or os.path.getsize(report) == 0:
        raise SystemExit(
            'could not run %s (%s)\n%s\n%s'
            % (suite['title'], ' '.join(cmd), done.stdout[-2000:], done.stderr[-2000:]))
    results = junit(report)
    os.unlink(report)
    if done.returncode != 0 and 'Fail' not in results.values():
        raise SystemExit(
            '%s exited %d but the report shows nothing failing, so something '
            'went wrong outside the tests:\n%s\n%s'
            % (suite['title'], done.returncode,
               done.stdout[-2000:], done.stderr[-2000:]))
    return results


def cell(text):
    """One table cell: no pipes, no newlines, backticks kept for the markdown."""
    return text.replace('|', '\\|').replace('\n', ' ').strip()


def expected_cell(expected):
    if not expected:
        return ''
    shown = expected[:SHOWN]
    text = '; '.join('`%s`' % e for e in shown)
    if len(expected) > SHOWN:
        text += ' (%d assertions in all)' % len(expected)
    return cell(text)


def main():
    today = date.today().isoformat()
    suites = []
    total = 0
    failures = 0

    for suite in SUITES:
        cases = (py_cases if suite['kind'] == 'py' else node_cases)(suite['file'])
        results = run(suite)
        rows = []
        for n, case in enumerate(cases, start=1):
            verdict = results.get(case['key'], '')
            if not verdict:
                raise SystemExit(
                    '%s: the run did not report "%s". The document would be '
                    'guessing at its result.' % (suite['title'], case['key']))
            if verdict != 'Pass':
                failures += 1
            rows.append(dict(id='%s-%02d' % (suite['prefix'], n), **case,
                             result=verdict))
        total += len(rows)
        suites.append(dict(suite, rows=rows))

    out = []
    w = out.append

    w('# Test cases')
    w('')
    w('TuffyFlow, a campus companion for California State University, Fullerton.')
    w('')
    w('| | |')
    w('|---|---|')
    w('| Course | CPSC 362, Foundations of Software Engineering |')
    w('| University | California State University, Fullerton |')
    w('| Professor | Mehdi Peiravi |')
    w('| Semester | Fall 2026 |')
    w('| Generated | %s |' % today)
    w('')
    w('Every case below is a real automated test in this repository. The table is')
    w('generated by `tools/gen_test_cases.py`, which reads the test files for the')
    w('names and the expected results and runs all six suites for the pass or fail')
    w('column, so re-running it is what keeps this document from drifting. It')
    w('refuses to write the file if a suite will not run.')
    w('')
    w('**%d cases, %s, run on %s.**'
      % (total, 'all passing' if not failures else '%d failing' % failures, today))
    w('')
    w('| Suite | Cases | Covers | Command |')
    w('|---|---|---|---|')
    for s in suites:
        w('| %s | %d | %s | `%s` |'
          % (s['title'], len(s['rows']), s['covers'], s['command']))
    w('')
    w('Set the Python ones up first, which the read me also covers:')
    w('')
    w('```')
    w('python3 -m venv .venv')
    w('.venv/bin/pip install -r api/requirements.txt')
    w('```')
    w('')

    for s in suites:
        w('---')
        w('')
        w('## %s (%d cases)' % (s['title'], len(s['rows'])))
        w('')
        w(s['note'])
        w('')
        w('Covers: %s.  ' % s['covers'])
        w('File: `%s`  ' % s['file'])
        w('Command: `%s`' % s['command'])
        w('')
        w('| ID | Precondition | What it checks | Expected result | Result |')
        w('|---|---|---|---|---|')
        for r in s['rows']:
            w('| %s | %s | %s | %s | %s |'
              % (r['id'], cell('`%s`' % r['setup'] if r['setup'] else ''),
                 cell(r['checks']), expected_cell(r['expected']), r['result']))
        w('')

    with open(os.path.join(ROOT, 'TEST_CASES.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(out).rstrip() + '\n')
    print('TEST_CASES.md: %d cases across %d suites, %d failing'
          % (total, len(suites), failures))


if __name__ == '__main__':
    main()
