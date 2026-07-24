import tseslint from 'typescript-eslint'

export default tseslint.config({
  files: ['src/**/*.ts', 'lib/**/*.ts', 'bin/**/*.ts'],
  ignores: [
    '**/*.d.ts',
    '**/*.js',
    'node_modules/**',
    'cdk.out/**',
    'dist/**',
    'layer/**',
  ],
  extends: [...tseslint.configs.recommended],
  languageOptions: {
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-console': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
  },
})
