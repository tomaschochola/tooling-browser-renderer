import { ESLintConfigBuilder, filePatterns } from '@tomaschochola/tooling-eslint';

export default new ESLintConfigBuilder()
    .addNodeGlobals({ files: ['eslint.config.js', 'prettier.config.js', 'stylelint.config.js', 'src/**/*.js', 'tests/**/*.js'] })
    .addBrowserGlobals({ files: ['products/**/*.js'] })
    .addGitIgnoreFile(import.meta.url)
    .addJavaScriptRecommendedRules({ files: filePatterns.scripts })
    // .addSonarJsRecommendedRules({ files: ['products/**/*.js'] })
    .toConfig();
