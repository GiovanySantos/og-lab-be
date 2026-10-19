import globals from 'globals';
import tseslint from 'typescript-eslint';

const typeScriptFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

export default tseslint.config(
  {
    ignores: ['coverage/**', 'dist/**'],
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: config.files ?? typeScriptFiles,
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true,
        },
      ],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'never',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            never: 'Do not use never as a type annotation.',
            unknown: 'Do not use unknown as a type annotation.',
          },
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'PropertyDefinition[definite=true]',
          message: 'Do not use definite-assignment assertions; initialize the property.',
        },
      ],
    },
  },
);
