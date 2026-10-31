import { StylelintConfigBuilder } from '@tomaschochola/tooling-stylelint';

export default new StylelintConfigBuilder()
    .addRecommendedScssConfig()
    // Replace the preceding recommended profile with .addStandardScssConfig() when its complete policy is desired.
    // .addStandardScssConfig()
    .toConfig();
