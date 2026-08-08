import sys

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    lines = f.readlines()

start = None
end = None
for i, line in enumerate(lines):
    if 'const renderThumb = (props' in line:
        start = i
    if start is not None and line.strip() == ');' and i > start:
        end = i
        break

if start is not None and end is not None:
    new_lines = [
        '\tconst renderThumb = (props: Record<string, unknown>) => (\n',
        '\t\t<div\n',
        '\t\t\t{...props}\n',
        '\t\t\tstyle={{\n',
        '\t\t\t\t...(props.style as React.CSSProperties),\n',
        '\t\t\t\tbackgroundColor: "#14b8a6",\n',
        '\t\t\t\tborderRadius: 4,\n',
        '\t\t\t}}\n',
        '\t\t/>\n',
        '\t);\n',
    ]
    lines[start:end+1] = new_lines
    with open(filepath, 'w') as f:
        f.writelines(lines)
    print(f"OK: replaced lines {start+1}-{end+1}")
else:
    print(f"FAIL: start={start}, end={end}")
