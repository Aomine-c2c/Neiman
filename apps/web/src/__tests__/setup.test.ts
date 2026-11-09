import '@testing-library/jest-dom';

// Simple test to verify test infrastructure works
describe('Test Infrastructure', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });

  it('should have jest-dom matchers', () => {
    const div = document.createElement('div');
    div.textContent = 'Hello';
    document.body.appendChild(div);
    expect(div).toHaveTextContent('Hello');
    document.body.removeChild(div);
  });
});