// eslint.config.ts
import type { Linter } from 'eslint'
import pluginVue from 'eslint-plugin-vue'
import pluginImport from 'eslint-plugin-import'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

const baseRules: Linter.RulesRecord = {
  // コンポーネント名が複数単語かどうか
  'vue/multi-word-component-names': 'off',
  // import パスのうち不要な部分(拡張子 .js など)を禁止
  'import/no-useless-path-segments': ['error', { noUselessIndex: false }],
  // ファイル間の循環参照を検出
  'import/no-cycle': 'error',
  // 明示的な型付けがない場合でも許可するか
  '@typescript-eslint/no-inferrable-types': 'off',
  // 'any'型の使用を許可するか(Componentでanyを使うので許容)
  '@typescript-eslint/no-explicit-any': 'off',
  // const'の強制
  'prefer-const': 'off',
  // 未使用の変数 (_ は例外)
  '@typescript-eslint/no-unused-vars': ['warn', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
  }],
  // 空の関数定義
  '@typescript-eslint/no-empty-function': 'warn',
  // Vueコンポーネント内の未使用変数
  'vue/no-unused-vars': 'warn',
  // 空のオブジェクト型 '{}' の使用
  '@typescript-eslint/no-empty-object-type': 'warn',
  // 安全でない代入
  '@typescript-eslint/no-unsafe-assignment': 'warn',
  // 安全でないメンバーアクセス
  '@typescript-eslint/no-unsafe-member-access': 'warn',
  // 安全でない関数の呼び出し
  '@typescript-eslint/no-unsafe-call': 'warn',
}

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['src/**/*.{ts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.test.ts',
    ],
  },

  // Vue essential (flat)
  ...pluginVue.configs['flat/essential'],

  // TypeScript (推奨構成)
  vueTsConfigs.recommended,

  {
    name: 'import-plugin-config',
    plugins: {
      import: pluginImport,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json'],
          alwaysTryTypes: true,
        },
        node: {
          extensions: ['.ts', '.tsx', '.vue'],
        },
      },
    },
  },

  {
    name: 'app/base-rules',
    rules: baseRules,
  },
  skipFormatting,
)