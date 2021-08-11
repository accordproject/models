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
    FileWriter: require(`concerto-tools-${version}`).FileWriter,
    CodeGen: require(`concerto-tools-${version}`).CodeGen,
});

module.exports = {
    defaultVersion: '1.0.0',
    '1.0.0': concertoFromVersion('1.0'),
    '0.82.11': concertoFromVersion('0.82'),
};
