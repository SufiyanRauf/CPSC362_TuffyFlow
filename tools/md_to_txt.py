"""Turn one of our markdown documents into the plain text version.

The professor asked for the read me in text format, so README.txt and
TEST_CASES.txt are both handed in. They are generated, not maintained: edit
the markdown and run this.

    python3 tools/md_to_txt.py README.md README.txt

Markdown that is only punctuation on the page has to become something a
person reads in a terminal or in Notepad, which means a few decisions:

  * Headings get underlines rather than hashes. Three levels, three
    characters, so the shape of the document survives.
  * Fenced code is indented four spaces and the language tag goes. A fence
    inside a numbered step is indented past the step, not level with the
    prose around it, or the commands and the sentences look the same.
  * A table wider than the page is printed as one block per row instead of
    a grid. The provenance table in the read me is 244 characters across,
    and a grid that wide is unreadable in any window.
  * Output is plain ASCII. A .txt opened in the wrong encoding shows
    "anybody's" as mojibake, so the curly quotes and dashes are folded down.
"""
import re
import sys
import textwrap
from datetime import date

PAGE = 100          # how wide a table may be before it becomes blocks
WRAP = 88           # where prose is folded, narrow enough for any window
INDENT = ' ' * 4    # code indent, the convention every README uses

# What a .txt cannot carry safely. Folded rather than dropped so nothing
# silently disappears from a submitted document.
ASCII_FOLD = {
    '‘': "'", '’': "'", '“': '"', '”': '"',
    '–': '-', '—': '--', '…': '...', ' ': ' ',
    '→': '->', '×': 'x', '✕': 'x', '✓': 'v',
    '·': '-', '•': '*',
}

UNDERLINE = {1: '=', 2: '-', 3: '.'}


def fold(text):
    for bad, good in ASCII_FOLD.items():
        text = text.replace(bad, good)
    return text


def inline(text):
    """Strip the markup that only means something to a renderer.

    Bold and italic markers go, backticks go, and a link becomes its text
    followed by the target in brackets. A link whose text is already the
    target is left as just the text: "DECISIONS.md (DECISIONS.md)" says
    nothing twice.
    """
    def link(m):
        label, target = m.group(1), m.group(2)
        return label if label == target else '%s (%s)' % (label, target)

    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'(?<![\w*])\*([^*\n]+)\*(?![\w*])', r'\1', text)
    text = text.replace('`', '')
    return fold(text)


def wrap(text, first, rest):
    """Fold a paragraph to the page, keeping a list marker hanging."""
    return textwrap.wrap(text, width=WRAP, initial_indent=first,
                         subsequent_indent=rest,
                         break_long_words=False, break_on_hyphens=False) or [first.rstrip()]


# "7. ", "- ", "* " -- the markers whose continuation lines have to line up
# under the text rather than under the marker.
MARKER = re.compile(r'^(\s*)((?:[-*+]|\d{1,3}[.)])\s+)?(.*)$')


def starts_item(line):
    """Whether this line opens a new list item rather than continuing one."""
    return bool(re.match(r'\s*(?:[-*+]|\d{1,3}[.)])\s+\S', line))


def paragraph(block):
    """A run of prose lines as one folded paragraph."""
    head = MARKER.match(block[0])
    pad, mark, first = head.group(1), head.group(2) or '', head.group(3)
    body = ' '.join([first] + [b.strip() for b in block[1:]]).strip()
    return wrap(body, pad + mark, pad + ' ' * len(mark))


def is_row(line):
    return line.lstrip().startswith('|')


def is_divider(line):
    return bool(re.fullmatch(r'\s*\|[\s:|-]+\|\s*', line))


def cells(line):
    return [inline(c).strip() for c in line.strip().strip('|').split('|')]


def table(rows):
    """A markdown table as either an aligned grid or one block per row."""
    grid = [cells(r) for r in rows if not is_divider(r)]
    if not grid:
        return []
    width = max(len(r) for r in grid)
    grid = [r + [''] * (width - len(r)) for r in grid]
    widest = [max(len(r[i]) for r in grid) for i in range(width)]

    if sum(widest) + 2 * (width - 1) <= PAGE:
        out = []
        for n, row in enumerate(grid):
            out.append('  '.join(
                cell.ljust(widest[i]) for i, cell in enumerate(row)).rstrip())
            if n == 0:
                out.append('  '.join('-' * widest[i] for i in range(width)))
        return out

    # Too wide for a grid. The header names the fields, so each following
    # row becomes a labelled block and nothing has to line up.
    head, body = grid[0], grid[1:]
    label = max(len(h) for h in head) + 2
    out = []
    for row in body:
        for name, cell in zip(head, row):
            if not cell:
                continue
            tag = (name + ':').ljust(label) if name else ' ' * label
            out.extend(wrap(cell, tag, ' ' * label))
        out.append('')
    while out and out[-1] == '':
        out.pop()
    return out


def convert(source, name):
    lines = source.replace('\r\n', '\n').split('\n')
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # fenced code, at the top level or inside a numbered step
        if stripped.startswith('```'):
            opened = len(line) - len(line.lstrip())
            i += 1
            block = []
            while i < len(lines) and not lines[i].strip().startswith('```'):
                block.append(lines[i])
                i += 1
            i += 1
            # A fence inside a list item is indented past the step it belongs
            # to, so the commands never sit level with the sentences.
            pad = INDENT + ' ' * opened
            if out and out[-1] != '':
                out.append('')
            for b in block:
                out.append((pad + fold(b).rstrip()) if b.strip() else '')
            out.append('')
            continue

        # heading
        head = re.fullmatch(r'(#{1,3}) +(.*)', line)
        if head:
            level, text = len(head.group(1)), inline(head.group(2)).strip()
            if out and out[-1] != '':
                out.append('')
            out.append(text)
            out.append(UNDERLINE[level] * len(text))
            out.append('')
            i += 1
            continue

        # table
        if is_row(line):
            rows = []
            while i < len(lines) and is_row(lines[i]):
                rows.append(lines[i])
                i += 1
            if out and out[-1] != '':
                out.append('')
            out.extend(table(rows))
            out.append('')
            continue

        # horizontal rule
        if re.fullmatch(r'-{3,}|\*{3,}|_{3,}', stripped):
            if out and out[-1] != '':
                out.append('')
            out.append('-' * 70)
            out.append('')
            i += 1
            continue

        # a run of prose lines, folded to the page as one paragraph. A line
        # ending in two spaces is a markdown hard break, so it closes the run
        # and keeps its own line: the per suite "Covers / File / Command"
        # lines are three separate facts and read as one sentence otherwise.
        if stripped:
            block = []
            if line.endswith('  '):
                out.extend(paragraph([inline(line).rstrip()]))
                i += 1
                continue
            while i < len(lines) and lines[i].strip() and not (
                    is_row(lines[i]) or lines[i].strip().startswith('```')
                    or re.fullmatch(r'#{1,6} +.*', lines[i])
                    or re.fullmatch(r'-{3,}|\*{3,}|_{3,}', lines[i].strip())
                    # a marker opens its own item; it never continues the last
                    or (block and starts_item(lines[i]))
                    # and a hard break closes the run after taking its line
                    or (block and lines[i - 1].endswith('  '))):
                block.append(inline(lines[i]).rstrip())
                i += 1
            out.extend(paragraph(block))
            continue

        out.append('')
        i += 1

    # one blank line between things, never three, and no trailing whitespace
    text = '\n'.join(out)
    text = re.sub(r'\n{3,}', '\n\n', text).strip('\n')

    header = ('Generated from %s on %s. Edit the markdown, not this file:\n'
              '    python3 tools/md_to_txt.py %s %s\n'
              % (name, date.today().isoformat(), name, name[:-3] + '.txt'))
    return header + '\n' + text + '\n'


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: md_to_txt.py <in.md> <out.txt>')
    src, dest = sys.argv[1], sys.argv[2]
    with open(src, encoding='utf-8') as f:
        text = convert(f.read(), src)
    bad = sorted({c for c in text if ord(c) > 126})
    if bad:
        raise SystemExit('not plain ascii, add to ASCII_FOLD: %r' % bad)
    with open(dest, 'w', encoding='ascii', newline='\n') as f:
        f.write(text)
    print('%s -> %s, %d lines' % (src, dest, text.count('\n')))


if __name__ == '__main__':
    main()
