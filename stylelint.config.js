import { StylelintConfigBuilder } from '@tomaschochola/tooling-stylelint';

export default new StylelintConfigBuilder()
    .addRecommendedScssConfig()
    // .addStandardScssConfig()
    .toConfig();
