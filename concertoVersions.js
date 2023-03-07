/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const concertoFromVersion = (version) => ({
    ModelManager: require(`concerto-core-${version}`).ModelManager,
    concertoVersion: require(`concerto-core-${version}`).version.version,
    ModelFile: require(`concerto-core-${version}`).ModelFile,
    MetaModel: require(`concerto-core-${version}`).MetaModel,
    FileWriter: version !== '0.82' ? require(`concerto-util-${version}`).FileWriter : require(`concerto-tools-${version}`).FileWriter,
    CodeGen: require(`concerto-tools-${version}`).CodeGen,
    Parser: version !== '0.82' ? require(`concerto-cto-${version}`).Parser : null,
});

/**
 * This is a little confusing, because we conflate CTO syntax version
 * with the version of the Concerto library that can be used to parse the CTO synax.
 * So the default version is now 2.0.0, because anything other than 0.82 CTO syntax or lower
 * should be compatible with version 2.0.x of the CTO parser
 */
module.exports = {
    // We're forced to use version 2 by default, because we want to force strict mode in version 3.
    // Older models do not have version declarations and we can't modify them retrospectively
    defaultVersion: '2.0.0',
    // '0.82.11': concertoFromVersion('0.82'),
    '2.0.0': concertoFromVersion('2.0'),
    '3.6.0': concertoFromVersion('3.6'),
};
