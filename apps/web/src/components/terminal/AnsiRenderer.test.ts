import { parseAnsiString } from './AnsiRenderer';

describe('AnsiRenderer — parseAnsiString', () => {
  it('parses plain text without escape sequences', () => {
    const tokens = parseAnsiString('Hello sovereign terminal');
    expect(tokens).toEqual([
      { text: 'Hello sovereign terminal', className: '' },
    ]);
  });

  it('parses ANSI foreground color escape codes', () => {
    const raw = '\x1b[32mSUCCESS\x1b[0m \x1b[31mFAILURE\x1b[0m';
    const tokens = parseAnsiString(raw);

    expect(tokens.length).toBeGreaterThanOrEqual(2);
    expect(tokens[0].text).toBe('SUCCESS');
    expect(tokens[0].className).toContain('text-emerald');
    expect(tokens[2].text).toBe('FAILURE');
    expect(tokens[2].className).toContain('text-red');
  });

  it('parses bold and bright color codes', () => {
    const raw = '\x1b[1;36mNEIMAN OS\x1b[0m';
    const tokens = parseAnsiString(raw);

    expect(tokens[0].text).toBe('NEIMAN OS');
    expect(tokens[0].className).toContain('font-bold');
    expect(tokens[0].className).toContain('text-cyan');
  });

  it('strips cursor motion control sequences cleanly', () => {
    const raw = '\x1b[?25h\x1b[2J\x1b[HClean Screen';
    const tokens = parseAnsiString(raw);
    expect(tokens[0].text).toBe('Clean Screen');
  });
});

