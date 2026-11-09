module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@neiman/types$': '<rootDir>/../../packages/types/index.ts',
    '^@neiman/core$': '<rootDir>/../../packages/core/index.ts',
    '^@neiman/events$': '<rootDir>/../../packages/events/index.ts',
    '^@neiman/permissions$': '<rootDir>/../../packages/permissions/index.ts',
    '^@neiman/config$': '<rootDir>/../../packages/config/index.ts',
    '^@neiman/validation$': '<rootDir>/../../packages/validation/index.ts',
    '^@neiman/auth$': '<rootDir>/../../packages/auth/index.ts',
    '^@neiman/api$': '<rootDir>/../../packages/api/index.ts',
    '^@neiman/ui$': '<rootDir>/../../packages/ui/index.tsx',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      { tsconfig: { ...require('./tsconfig.json').compilerOptions, jsx: 'react-jsx' } },
    ],
  },
  testMatch: ['<rootDir>/src/**/*.test.(ts|tsx)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
};
