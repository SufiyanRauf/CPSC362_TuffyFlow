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
import platform
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
         note='Mostly pure functions over dicts, so the whole file runs in '
              'about half a second. A dozen of them do reach for the request '
              'models in api/recommend.py, because the bounds on a field are '
              'worth checking where they are declared, and one shells out to '
              'Node to read the real campus rows. No database either way.'),
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
              'prints a wall of red PERMISSION_DENIED lines, because most of '
              'these cases are refusals that are supposed to happen. Seven '
              'are the other way round, checking that the owner is still let '
              'through, because a rule that refuses everybody passes every '
              'refusal test there is.'),
    dict(prefix='DATE', title='Event dating', file='tests/event_dates.test.mjs',
         kind='node', command='npm run test:dates',
         covers='Event dates and times',
         note='The daylight saving arithmetic, which is the part of the '
              'event screen that has no second chance to be right.'),
    dict(prefix='CLK', title='Clock formatting', file='tests/clock_text.test.mjs',
         kind='node', command='npm run test:dates',
         covers='The screens that read a stored time through src/lib/time.ts',
         note='time.ts turns a stored time into something a student reads, '
              'and five screens call these functions, so one broken branch '
              'here is wrong on all five at once. Three more files import '
              'time.ts for the campus timezone alone and are untouched by it; '
              'the two event screens format their own dates with Intl and are '
              'covered by Event dating instead.'),
    dict(prefix='PARK', title='Parking occupancy curve',
         file='tests/parking_curve.test.mjs',
         kind='node', command='npm run test:parking',
         covers='Parking',
         note='The occupancy figures the parking screen shows. The first two '
              'read the board readings out of data/parking_samples.csv, so '
              'adding a reading there is enough to check the curve against '
              'it; the other three pin the shape of the seed itself, and '
              'those do carry numbers written into the test.'),
    dict(prefix='CLUB', title='Club ranking', file='tests/club_ranking.test.mjs',
         kind='node', command='npm run test:clubs',
         covers='Club matching',
         note='The order the club list comes out in, which is the whole '
              'point of that screen and the one thing on it worth testing.'),
]


# The numbered requirements, and how each one is traced to the cases that
# check it. The course asks for these to be numbered and traced to the
# features, with non functional ones for response time, the security model and
# what happens with no data.
#
# Three things keep this honest, and all three are refusals rather than
# comments, because a traceability matrix is the easiest document in a project
# to make look complete:
#
#   a requirement that matches no case        stops the script
#   a rule, or a word in one, that matches    stops the script
#     nothing
#   a case that matches no requirement and    stops the script
#     is not named in SHARED below
#
# The middle one is the one worth having. An earlier version had eight rule
# words that had never matched anything -- two of them were written against the
# wrong suite, one could not match because humanise() turns "stand_in" into
# "stand in", and one requirement's whole HTTP rule was dead -- and the matrix
# looked perfectly healthy throughout, because the requirements were being
# carried by their other rules.
#
# A rule is (suite prefix, words that must appear in the Precondition, words of
# which one must appear in the test name, names this rule must not claim).
# None means "do not care". Matching is on whole words, because "anchor" inside
# "anchors" traced two normalize tests to the weekly schedule.
REQUIREMENTS = [
    dict(id='FR-1',
         text='A student can record and change a profile holding their name, '
              'major, interests, career goals, permit type and noise '
              'preference, and can delete it.',
         rules=[('SEC', 'own profile', None, None)]),
    dict(id='FR-2',
         text='A student can add a class to a weekly schedule, read the '
              'schedule back, and remove a class from it.',
         rules=[('SEC', 'own schedule', None, None)]),
    dict(id='FR-3',
         text='The app offers parking lots for the class the student is '
              'heading to, ordered by how far the walk is and how full the lot '
              'usually is at that hour, and says when to leave.',
         rules=[('SC', None,
                 ('lot', 'parking', 'permit', 'fullness', 'arrive', 'offered'),
                 ('at nowhere is dropped', 'is refused')),
                ('API', None, ('parking',), None)]),
    dict(id='FR-4',
         text='The app offers campus study spots that are open at the time the '
              'student is looking, measured from where they already are that '
              'day, and ordered by walk, noise and power.',
         rules=[('SC', None, ('spot', 'spots', 'noise', 'open', 'shut', 'hours'),
                 ('at nowhere is dropped', 'bounds still bite')),
                ('SC', None, ('somewhere',), None)]),
    dict(id='FR-5',
         text='The app offers campus events that match what the student is '
              'interested in, are still to come, and do not clash with a class '
              'that day.',
         rules=[('SC', None,
                 ('event', 'events', 'tag', 'tags', 'clash', 'sooner'), None),
                ('API', None, ('event',), None),
                ('DATE', None, None, None)]),
    dict(id='FR-6',
         text='The app orders registered clubs by how well they match the '
              'interests the student entered, putting a rarely shared interest '
              'above a common one.',
         rules=[('CLUB', None, None, None)]),
    dict(id='FR-7',
         text='The campus data is readable to a student who has signed in, and '
              'to nobody else.',
         rules=[('SEC', 'logged out', None, None),
                ('SEC', 'anonymous', None, None),
                ('SEC', 'signed in student', None, None)]),
    dict(id='FR-8',
         text='Every recommendation is measured from the class the student is '
              'next heading to, or was last at, rather than from a fixed point '
              'on campus.',
         rules=[('SC', None, ('anchor', 'class'), None)]),
    dict(id='NFR-1',
         text='A student can read and write their own profile and schedule and '
              'nobody else\'s, and no signed in student can change the campus '
              'data.',
         rules=[('SEC', 'against another', None, None),
                ('SEC', 'logged out', None, None),
                ('SEC', 'signed in student', None, None)]),
    dict(id='NFR-2',
         text='Every value the app stores is bounded and type checked by the '
              'database rules themselves, so a client that skips the screen '
              'still cannot write a bad one.',
         rules=[('SEC', None, ('refuses', 'cannot', 'only'), None)]),
    dict(id='NFR-3',
         text='A malformed request to the scoring endpoint is refused with a '
              '422 that names the field and never repeats the value it '
              'rejected, and a well formed one never produces a server error.',
         rules=[('API', None, None, None),
                ('SC', None,
                 ('refused', 'infinity', 'bounds', 'model'), None)]),
    dict(id='NFR-4',
         text='Every time and date the student reads is campus time, and stays '
              'correct across daylight saving and the turn of the year.',
         rules=[('DATE', None, None, None), ('CLK', None, None, None)]),
    dict(id='NFR-5',
         text='The occupancy figures reproduce the board readings they were '
              'fitted to, and where there is no reading for an hour the app '
              'says so rather than presenting a guess as a measurement.',
         rules=[('PARK', None, None, None),
                ('SC', None, ('availability',), None)]),
    dict(id='NFR-6',
         text='Ranking a whole campus of candidates costs well under a second, '
              'and the cost grows with the number of candidates rather than '
              'faster.',
         rules=[('SC', None, ('ranked', 'cost'), None)]),
    dict(id='NFR-7',
         text='With no profile, no schedule, or nothing left after filtering, '
              'every screen says so plainly instead of failing or inventing a '
              'recommendation.',
         rules=[('API', None, ('empty', 'nothing'), None),
                ('SC', None, ('empty', 'nothing', 'never knew'), None)]),
]

# Cases that are not evidence for any one requirement: the geometry,
# normalisation and ranking mechanics that all three recommenders sit on. Every
# other case has to match a requirement or the script stops, so this list is a
# decision rather than a leftover. Matched on the whole printed name.
SHARED = [
    'Haversine matches real campus distance',
    'Haversine catches missing radians conversion',
    'Walk minutes is a sensible campus walk',
    'Normalize lower is better',
    'Normalize clamps outside the anchors',
    'Normalize handles equal anchors',
    'Normalize scores not a number as zero rather than a full mark',
    'Rank is stable when everything ties',
    'Rank handles nothing to rank and honours top n',
    'Scores are not all near 100 on a bad day',
    'Match percent is a whole number 0 to 100',
    'Haversine survives two points on opposite sides of the planet',
    'Weight tables each add up to one',
    'The weight tables keep the order they were designed with',
    'A factor that returns not a number scores zero not a perfect match',
    'The walk reason does not repeat the number',
    'The neutral walk stand in sits at the midpoint',
]


def requirements_for(prefix, case):
    """Which requirements a case traces to, by the rules above."""
    setup = (case.get('setup') or '').lower()
    checks = (case.get('checks') or '').lower()
    out = []
    for req in REQUIREMENTS:
        for rule in req['rules']:
            if rule_matches(rule, prefix, setup, checks):
                out.append(req['id'])
                break
    return out


def rule_matches(rule, prefix, setup, checks):
    want_prefix, want_setup, want_words, forbid = rule
    if want_prefix != prefix:
        return False
    if want_setup is not None and want_setup not in setup:
        return False
    if forbid is not None and any(f in checks for f in forbid):
        return False
    if want_words is None:
        return True
    # Whole words, not substrings. Matching on substrings traced two normalize
    # tests ("clamps outside the anchors") to the weekly schedule, because
    # "anchor" sits inside "anchors". A trace that is wrong is worse than a
    # case with no trace at all.
    return any(re.search(r'\b%s\b' % re.escape(w), checks) for w in want_words)


# Which of the four features each requirement serves. The course asks for the
# requirements to be traced to the features, not only to the cases, so this is
# the other half of that trace. Every requirement has to appear exactly once.
FEATURES = [
    ('Parking', ['FR-3', 'NFR-5']),
    ('Campus study spots', ['FR-4']),
    ('Clubs', ['FR-6']),
    ('Events', ['FR-5']),
    ('All four, and what they rest on',
     ['FR-1', 'FR-2', 'FR-7', 'FR-8',
      'NFR-1', 'NFR-2', 'NFR-3', 'NFR-4', 'NFR-6', 'NFR-7']),
]


def platform_line():
    return '%s %s (%s)' % (platform.system(), platform.release(), platform.machine())


def node_version():
    try:
        out = subprocess.run(['node', '--version'], capture_output=True, text=True)
        return out.stdout.strip() or 'not found'
    except OSError:
        return 'not found'


def ids_range(ids):
    """A list of case ids, collapsed to runs so the cell stays readable."""
    if not ids:
        return '--'
    runs, start, prev = [], ids[0], ids[0]
    for cur in ids[1:]:
        pre, num = cur.rsplit('-', 1)
        ppre, pnum = prev.rsplit('-', 1)
        if pre == ppre and int(num) == int(pnum) + 1:
            prev = cur
            continue
        runs.append((start, prev))
        start = prev = cur
    runs.append((start, prev))
    return ', '.join(a if a == b else '%s to %s' % (a, b) for a, b in runs)


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
                # Deliberately not called depth: that name belongs to the
                # describe nesting tracked by the outer loop, and reusing it
                # here left the tracker holding this counter's leftover zero,
                # which dropped the describe subject from every test after the
                # first one in a block.
                open_brackets = balance(text)
                while open_brackets > 0 and k + 1 < len(body):
                    k += 1
                    text += ' ' + body[k].strip()
                    open_brackets += balance(body[k])
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
    skipped = 0

    for suite in SUITES:
        cases = (py_cases if suite['kind'] == 'py' else node_cases)(suite['file'])
        results = run(suite)
        # Every test the run reported has to be one the parser also found.
        # Without this the two halves can disagree silently: a test written in
        # a shape the parser does not recognise still runs, still fails, and
        # still lands in the report, but it never becomes a row, so the count
        # below never sees it and the front page keeps saying all passing. The
        # returncode tripwire in run() does not catch that case either, because
        # the report does contain a failure, just not one of ours.
        missed = sorted(name for name in results if name not in {c['key'] for c in cases})
        if missed:
            raise SystemExit(
                '%s: the run reported %d test(s) the parser never found, so '
                'they would be left out of the document and their result would '
                'go unreported: %s'
                % (suite['title'], len(missed), ', '.join(missed[:5])))
        # And the other direction. The check above makes the two name SETS
        # equal; it does not make them the same size. Two functions with the
        # same name in one file are one test to the runner and two cases to the
        # parser, because the parser reads the source and Python keeps only the
        # last definition. Both rows then take the single result, so the one
        # that never ran is printed as a Pass with its assertions beside it,
        # and the total is inflated by one. junit() already refuses duplicates
        # on its side of the comparison; this is the same refusal on ours.
        seen = {}
        for case in cases:
            seen[case['key']] = seen.get(case['key'], 0) + 1
        twice = sorted(k for k, n in seen.items() if n > 1)
        if twice:
            raise SystemExit(
                '%s: %s defined more than once. Only the last one runs, so the '
                'others would be printed with a result they never earned: %s'
                % (suite['title'], 'a test is' if len(twice) == 1 else 'tests are',
                   ', '.join(twice[:5])))
        rows = []
        for n, case in enumerate(cases, start=1):
            verdict = results.get(case['key'], '')
            if not verdict:
                raise SystemExit(
                    '%s: the run did not report "%s". The document would be '
                    'guessing at its result.' % (suite['title'], case['key']))
            if verdict == 'Fail':
                failures += 1
            elif verdict != 'Pass':
                # Skipped is neither. junit() deliberately keeps it out of Pass
                # so the row is honest; counting it here as a failure made the
                # front page say "1 failing" when nothing had failed. It is
                # counted on its own and named in the summary line.
                skipped += 1
            rows.append(dict(id='%s-%02d' % (suite['prefix'], n), **case,
                             requirements=requirements_for(suite['prefix'], case),
                             result=verdict))
        total += len(rows)
        suites.append(dict(suite, rows=rows))

    # Trace both ways. Forwards gives the matrix; backwards tells us whether a
    # requirement is only claimed rather than checked.
    covering = {req['id']: [] for req in REQUIREMENTS}
    unmapped = []
    for s in suites:
        for r in s['rows']:
            if r['requirements']:
                for rid in r['requirements']:
                    covering[rid].append(r['id'])
            else:
                unmapped.append(r['id'])
    listed = [rid for _, ids in FEATURES for rid in ids]
    known = {req['id'] for req in REQUIREMENTS}
    missing = sorted(known - set(listed))
    twice_listed = sorted({r for r in listed if listed.count(r) > 1})
    unknown = sorted(set(listed) - known)
    if missing or twice_listed or unknown:
        raise SystemExit(
            'the feature table and the requirements disagree. missing: %s; '
            'listed twice: %s; not a requirement: %s'
            % (missing or 'none', twice_listed or 'none', unknown or 'none'))

    bare = [rid for rid, ids in covering.items() if not ids]
    if bare:
        raise SystemExit(
            'nothing checks %s. A requirement with no case behind it is the '
            'kind of thing this document exists to make impossible, so fix the '
            'rule or drop the requirement rather than shipping an empty row.'
            % ', '.join(bare))

    # A rule, or a single word inside one, that never matches anything. This is
    # the check that matters most, because a dead word is invisible: the
    # requirement still shows a healthy count from its other rules while one of
    # the things it claims to cover is quietly unchecked. An earlier version
    # carried eight of these at once.
    pool = {}
    for s_ in suites:
        pool.setdefault(s_['prefix'], []).extend(s_['rows'])
    dead = []
    for req in REQUIREMENTS:
        for rule in req['rules']:
            prefix, setup, words, forbid = rule
            rows = pool.get(prefix, [])
            if not rows:
                dead.append('%s: no suite %s' % (req['id'], prefix))
                continue
            def fires(w):
                return any(rule_matches((prefix, setup, (w,) if w else None, forbid),
                                        prefix,
                                        (r.get('setup') or '').lower(),
                                        (r.get('checks') or '').lower())
                           for r in rows)
            if words is None:
                if not fires(None):
                    dead.append('%s: rule (%s, %r) matches nothing'
                                % (req['id'], prefix, setup))
            else:
                for w in words:
                    if not fires(w):
                        dead.append('%s: %s word %r matches nothing'
                                    % (req['id'], prefix, w))
    if dead:
        raise SystemExit(
            'these tracing rules never match anything, so a requirement is '
            'claiming coverage it has not got:\n  ' + '\n  '.join(dead))

    # And every case has to be claimed by something, or named as shared. A case
    # that is neither is a test nobody decided about.
    stray = [r['id'] for s_ in suites for r in s_['rows']
             if not r['requirements'] and r['checks'] not in SHARED]
    if stray:
        raise SystemExit(
            '%d case(s) trace to no requirement and are not in SHARED, so '
            'nobody has decided what they are for: %s'
            % (len(stray), ', '.join(stray[:12])))
    unused_shared = [n for n in SHARED
                     if not any(r['checks'] == n for s_ in suites for r in s_['rows'])]
    if unused_shared:
        raise SystemExit('SHARED names a case that does not exist: %s'
                         % ', '.join(unused_shared))

    out = []
    w = out.append

    w('# Test cases')
    w('')
    w('Tuffy Flow, a campus companion for California State University, Fullerton.')
    w('')
    w('| | |')
    w('|---|---|')
    w('| Course | CPSC 362, Foundations of Software Engineering |')
    w('| University | California State University, Fullerton |')
    w('| Professor | Mehdi Peiravi |')
    w('| Semester | Fall 2026 |')
    w('| Team | Sufiyan Rauf, Bhavy Patel, Phillip Bryan |')
    w('| Contact | sufiyan24@csu.fullerton.edu |')
    w('| Generated | %s |' % today)
    w('')
    w('### The machine these were run on')
    w('')
    w('| | |')
    w('|---|---|')
    w('| Operating system | %s |' % platform_line())
    w('| Python | %s, in the project\'s own `.venv` |'
      % platform.python_version())
    w('| Node | %s |' % node_version())
    w('| Java | only for the rules suite, which runs the Firestore emulator |')
    w('')
    w('Every case below is a real automated test in this repository. The table is')
    w('generated by `tools/gen_test_cases.py`, which reads the test files for the')
    w('names and the expected results and runs all %d suites for the pass or fail'
      % len(suites))
    w('column, so re-running it is what keeps this document from drifting. It')
    w('refuses to write the file if a suite will not run, if a test runs that it')
    w('could not find in the source, if the same test name is defined twice, or')
    w('if any requirement below is left with nothing checking it.')
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
    w('## The four features, and the requirements behind them')
    w('')
    w('The requirements below are numbered so each case can say which one it is')
    w('there for. This table is the other half of that: which of the four')
    w('features each requirement belongs to. A requirement that is missing from')
    w('here, or listed twice, stops the script.')
    w('')
    w('| Feature | Requirements | Cases |')
    w('|---|---|---|')
    for feature, ids in FEATURES:
        n = len({c for rid in ids for c in covering[rid]})
        w('| %s | %s | %d |' % (feature, ', '.join(ids), n))
    w('')
    w('## What is not tested, and why')
    w('')
    w('Worth saying plainly, because "%d cases, all passing" invites the reader')
    w('to assume more than it should. There are no automated tests for the')
    w('React screens, the sign in flow or the map. The logic those screens')
    w('depend on was deliberately moved out of them, into `src/lib` and `api/`,')
    w('so that it could be tested without a browser harness, and that is what')
    w('the cases below cover. What is left in the components is layout and')
    w('wiring, and it is checked by hand.')
    w('')
    w('Two consequences are worth naming rather than leaving for a reader to')
    w('find. FR-1 and FR-2 are proved at the database rather than at the')
    w('screen: the evidence is that the rules accept a good write and refuse a')
    w('bad one, not that the form submits. And the demo mode, which lets')
    w('somebody try the app with no account, reads bundled rows instead of')
    w('Firestore, so no security rules case can reach it; it is checked by hand')
    w('too.')
    w('')
    w('## Requirements')
    w('')
    w('Numbered so that every case can say which one it is there for, and traced')
    w('in both directions: the Cases column is built by matching the rules in')
    w('`tools/gen_test_cases.py` against the tests that actually ran, and a')
    w('requirement that ends up with no cases stops the script rather than')
    w('appearing here with an empty row.')
    w('')
    w('| Requirement | What it means | Cases | Count |')
    w('|---|---|---|---|')
    for req in REQUIREMENTS:
        ids = covering[req['id']]
        w('| %s | %s | %s | %d |'
          % (req['id'], req['text'], ids_range(ids), len(ids)))
    w('')
    if unmapped:
        w('%d of the %d cases trace to no requirement on their own. They are the'
          % (len(unmapped), total))
        w('shared arithmetic every feature sits on, which is worth testing and is')
        w('not worth claiming as a requirement: %s.' % ids_range(unmapped))
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
        w('| ID | Traces to | Precondition | What it checks | Expected result '
          '| Result |')
        w('|---|---|---|---|---|---|')
        for r in s['rows']:
            w('| %s | %s | %s | %s | %s | %s |'
              % (r['id'], ', '.join(r['requirements']) or '--',
                 cell('`%s`' % r['setup'] if r['setup'] else ''),
                 cell(r['checks']), expected_cell(r['expected']), r['result']))
        w('')

    # Markdown tables only render when the delimiter row has exactly as many
    # cells as the header above it. Adding the "Traces to" column and not
    # widening the delimiter turned all seven case tables into paragraphs of
    # raw pipes on GitHub, which is the one place the professor is most likely
    # to open this. The text copies were fine throughout, which is exactly why
    # nothing noticed. Every other integrity check in this file exists because
    # of a mistake that got as far as the document; so does this one.
    for i, line in enumerate(out):
        if not line.startswith('|') or i + 1 >= len(out):
            continue
        below = out[i + 1]
        if not re.fullmatch(r'\|(?:\s*-{3,}\s*\|)+', below):
            continue
        head, rule = line.count('|'), below.count('|')
        if head != rule:
            raise SystemExit(
                'the table at line %d has %d header cells and %d in its '
                'delimiter, so it will not render as a table at all:\n  %s\n  %s'
                % (i + 1, head - 1, rule - 1, line[:90], below))

    with open(os.path.join(ROOT, 'TEST_CASES.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(out).rstrip() + '\n')
    print('TEST_CASES.md: %d cases across %d suites, %d failing, %d skipped'
          % (total, len(suites), failures, skipped))

    # The plain text copies are the other half of what gets handed in, and
    # nothing used to regenerate them. Leaving that to whoever remembered the
    # second command meant TEST_CASES.txt could keep an older date and older
    # verdicts while the markdown beside it was current, and the professor
    # reads whichever file he opens. One command writes both now.
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    import md_to_txt
    for name in ('TEST_CASES', 'README'):
        src = os.path.join(ROOT, name + '.md')
        dest = os.path.join(ROOT, name + '.txt')
        with open(src, encoding='utf-8') as f:
            text = md_to_txt.convert(f.read(), name + '.md')
        bad = sorted({c for c in text if ord(c) > 126})
        if bad:
            raise SystemExit('%s is not plain ascii: %r' % (dest, bad))
        with open(dest, 'w', encoding='ascii', newline='\n') as f:
            f.write(text)
        print('%s.txt: %d lines' % (name, text.count('\n')))


if __name__ == '__main__':
    main()
