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

const ModelManager = require('composer-common').ModelManager;
const ModelFile = require('composer-common').ModelFile;
const CodeGen = require('composer-common').CodeGen;
const rimraf = require('rimraf');
const path = require('path');
const nunjucks = require('nunjucks');
const {
    promisify
} = require('util');
const {
    resolve
} = require('path');
const fs = require('fs-extra')
const readdir = promisify(fs.readdir);
const rename = promisify(fs.rename);
const stat = promisify(fs.stat);
const mkdirp = require('mkdirp');
const showdown  = require('showdown');

async function getFiles(dir) {
    const subdirs = await readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = resolve(dir, subdir);
        return (await stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
}

const rootDir = resolve(__dirname, './src/');
const buildDir = resolve(__dirname, './build/');

(async function () {

    // delete build directory
    rimraf.sync('./build');

    nunjucks.configure('./views', { autoescape: true });
    
    // convert README.md to html
    await fs.ensureDir('./build');
    const readme = fs.readFileSync('README.md', 'utf8');
    const converter = new showdown.Converter();
    let indexHtml = converter.makeHtml(readme);
    await fs.copy('./README.md', './build/README.md');
    indexHtml += '<table>'

    // validate and copy all the files
    const files = await getFiles(rootDir);
    for( const file of files ) {
        const modelText = fs.readFileSync(file, 'utf8');
        const modelManager = new ModelManager();
        const modelFile  = new ModelFile(modelManager, modelText, file);     
        let modelFilePlantUML = '';
        // passed validation, so copy to build dir
        const dest = file.replace('/src/', '/build/');
        const destPath = path.dirname(dest);
        const fileName = path.basename(file);
        const fileNameNoExt = path.parse(fileName).name;
        const relative = path.relative(buildDir, destPath);
        await fs.ensureDir(destPath);
        const generatedPumlFile = `./${relative}/${fileNameNoExt}.puml`;
        try {
            if(process.env.VALIDATE) {
                modelManager.addModelFile(modelFile, modelFile.getName(), true);
                modelManager.updateExternalModels();

                // generate the PlantUML for the ModelFile
                const visitor = new CodeGen.PlantUMLVisitor();
                const fileWriter = new CodeGen.FileWriter(buildDir);
                // fileWriter.closeFile = () => {
                //     modelFilePlantUML = fileWriter.getBuffer();
                // };

                fileWriter.openFile(generatedPumlFile);
                fileWriter.writeLine(0, '@startuml');
                fileWriter.writeLine(0, 'title' );
                fileWriter.writeLine(0, 'Model' );
                fileWriter.writeLine(0, 'endtitle' );
                const params = {fileWriter : fileWriter};
                modelFile.accept(visitor, params);
                fileWriter.writeLine(0, '@enduml');
                fileWriter.closeFile();
            }

            await fs.copy(file, dest);
            console.log('Copied ' + file);

            // generate the html page for the model
            const generatedHtmlFile = `${relative}/${fileNameNoExt}.html`;
            const templateResult = nunjucks.render('model.njk', { modelFile: modelFile, modelFilePath: `https://accordproject-models.netlify.com/${relative}/${fileName}`, modelFilePlantUML: modelFilePlantUML });
            fs.writeFile( `./build/${generatedHtmlFile}`, templateResult, function (err) {
                if (err) {
                    return console.log(err);
                }
            });
            
            indexHtml += `<tr><td><a href="${generatedHtmlFile}">${generatedHtmlFile}</a></td></tr>`

        } catch (err) {
            console.log(err.message);
        }
    };

    indexHtml += '</table>'
    fs.writeFile('./build/index.html', indexHtml, function (err) {
        if (err) {
            return console.log(err);
        }
    });
})();