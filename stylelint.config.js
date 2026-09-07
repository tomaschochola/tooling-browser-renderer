/**
 * @file
 * @author Tomáš Chochola <tomaschochola@tomaschochola.cz>
 * @copyright © 2026 Tomáš Chochola <tomaschochola@tomaschochola.cz>
 *
 * @license CC-BY-ND-4.0
 *
 * @see {@link https://creativecommons.org/licenses/by-nd/4.0/} License
 * @see {@link https://github.com/tomaschochola} GitHub Profile
 * @see {@link https://github.com/sponsors/tomaschochola} GitHub Sponsors
 */

import { StylelintConfigBuilder } from '@tomaschochola/tooling-stylelint';

export default new StylelintConfigBuilder()
    .addRecommendedScssConfig()
    // Replace the preceding recommended profile with .addStandardScssConfig() when its complete policy is desired.
    // .addStandardScssConfig()
    .toConfig();
