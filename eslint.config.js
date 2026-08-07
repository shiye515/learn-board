import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', '.tanstack/**', '.wrangler/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@stylistic': stylistic,
      'react-hooks': reactHooks,
    },
    rules: {
      ...stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: false,
        commaDangle: 'always-multiline',
        braceStyle: '1tbs',
        jsx: true,
      }).rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)
