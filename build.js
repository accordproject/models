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
const AdmZip = require('adm-zip');

const plantumlEncoder = require('plantuml-encoder');

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

async function getFiles(dir) {
    const subdirs = await readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = resolve(dir, subdir);
        return (await stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
}

async function generatePlantUML(buildDir, destPath, fileNameNoExt, modelFile) {
    // generate the PlantUML for the ModelFile
    try {
        const generatedPumlFile = `${destPath}/${fileNameNoExt}.puml`;
        const visitor = new CodeGen.PlantUMLVisitor();
        const fileWriter = new CodeGen.FileWriter(buildDir);
        fileWriter.openFile(generatedPumlFile);
        fileWriter.writeLine(0, '@startuml');
        const params = {fileWriter : fileWriter};
        modelFile.accept(visitor, params);
        fileWriter.writeLine(0, '@enduml');
        fileWriter.closeFile();
        // save the UML
        const modelFilePlantUML = fs.readFileSync(generatedPumlFile, 'utf8');
        const encoded = plantumlEncoder.encode(modelFilePlantUML)
        return `https://www.plantuml.com/plantuml/svg/${encoded}`;        
    }
    catch(err) {
        console.log(err.message);
    }
}

async function generateTypescript(buildDir, destPath, fileNameNoExt, modelFile) {
    try {
        // generate the Typescript for the ModelFile
        const visitor = new CodeGen.TypescriptVisitor();
        const fileWriter = new CodeGen.FileWriter(buildDir);
        const params = {fileWriter : fileWriter};
        modelFile.accept(visitor, params);
    }
    catch(err) {
        console.log(err.message);
    }
}

async function generateJsonSchema(buildDir, destPath, fileNameNoExt, modelFile) {
    try {
            // generate the JSON Schema
            const visitor = new CodeGen.JSONSchemaVisitor();
            const params = {};
            const jsonSchemas = modelFile.accept(visitor, params);
            const generatedJsonFile = `${destPath}/${fileNameNoExt}.json`;
            // save JSON Schema
            fs.writeFile( `${generatedJsonFile}`, JSON.stringify(jsonSchemas), function (err) {
                if (err) {
                    return console.log(err);
                }
            });
    }
    catch(err) {
        console.log(err);
    }
}

async function generateJava(buildDir, destPath, fileNameNoExt, modelFile) {
    try {
            // generate the Java for the ModelFile
            const visitor = new CodeGen.JavaVisitor();
            const fileWriter = new CodeGen.FileWriter(buildDir);
            const zip = new AdmZip();
            
            // override closeFile to aggregate all the files into a single zip
            fileWriter.closeFile = function() {
                if (!this.fileName) {
                    throw new Error('No file open');
                }
        
                // add file to zip
                const content = fileWriter.getBuffer();
                zip.addFile(this.fileName, Buffer.alloc(content.length, content), `Generated from ${modelFile.getName()}`);
                zip.writeZip(`${destPath}/${fileNameNoExt}.jar`);

                this.fileName = null;
                this.relativeDir = null;
                this.clearBuffer();
            };
            const params = {fileWriter : fileWriter};
            modelFile.getModelManager().accept(visitor, params);
    }
    catch(err) {
        console.log(err.message);
    }
}

async function generateGo(buildDir, destPath, fileNameNoExt, modelFile) {
    try {
            // generate the Go Lang for the ModelFile
            const visitor = new CodeGen.GoLangVisitor();
            const fileWriter = new CodeGen.FileWriter(buildDir);
            const zip = new AdmZip();
            
            // override closeFile to aggregate all the files into a single zip
            fileWriter.closeFile = function() {
                if (!this.fileName) {
                    throw new Error('No file open');
                }
        
                // add file to zip
                const content = fileWriter.getBuffer();
                zip.addFile(this.fileName, Buffer.alloc(content.length, content), `Generated from ${modelFile.getName()}`);
                zip.writeZip(`${destPath}/${fileNameNoExt}.zip`);

                this.fileName = null;
                this.relativeDir = null;
                this.clearBuffer();
            };
            const params = {fileWriter : fileWriter};
            modelFile.getModelManager().accept(visitor, params);
    }
    catch(err) {
        console.log(err.message);
    }
}

const rootDir = resolve(__dirname, './src');
const buildDir = resolve(__dirname, './build');
let modelFileIndex = [];

// console.log('build: ' + buildDir);
// console.log('rootDir: ' + rootDir);

(async function () {

    // delete build directory
    rimraf.sync(buildDir);

    nunjucks.configure('./views', { autoescape: true });
    
    // copy the logo to build directory
    await fs.copy('accord_logo.png', './build/accord_logo.png');
    await fs.copy('_headers', './build/_headers');

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
        const relative = destPath.slice(buildDir.length);
        // console.log('dest: ' + dest);
        // console.log('destPath: ' + destPath);
        // console.log('relative: ' + relative);
        
        const fileName = path.basename(file);
        const fileNameNoExt = path.parse(fileName).name;

        await fs.ensureDir(destPath);
        let umlURL = '';
        try {
            modelManager.addModelFile(modelFile, modelFile.getName(), true);

            // use the FORCE_PUBLISH flag to disable download of
            // external models and model validation
            if(!process.env.FORCE_PUBLISH) {
                await modelManager.updateExternalModels();
            }

            umlURL = await generatePlantUML(buildDir, destPath, fileNameNoExt, modelFile);
            await generateTypescript(buildDir, destPath, fileNameNoExt, modelFile);
            await generateJsonSchema(buildDir, destPath, fileNameNoExt, modelFile);
            await generateJava(buildDir, destPath, fileNameNoExt, modelFile);
            await generateGo(buildDir, destPath, fileNameNoExt, modelFile);
            
            // copy the CTO file to the build dir
            await fs.copy(file, dest);

            // generate the html page for the model
            const generatedHtmlFile = `${relative}/${fileNameNoExt}.html`;
            const serverRoot = process.env.SERVER_ROOT;
            const templateResult = nunjucks.render('model.njk', { serverRoot: serverRoot, modelFile: modelFile, filePath: `${relative}/${fileNameNoExt}`, umlURL: umlURL });
            modelFileIndex.push( {htmlFile: generatedHtmlFile, modelFile: modelFile});
            console.log(`Processed ${modelFile.getNamespace()}`);

            fs.writeFile( `./build/${generatedHtmlFile}`, templateResult, function (err) {
                if (err) {
                    return console.log(err);
                }
            });
        } catch (err) {
            console.log(`Error handling ${modelFile.getName()}`);
            console.log(err);
        }
    };

    // generate the index html page
    modelFileIndex = modelFileIndex.sort((a, b) => a.modelFile.getNamespace().localeCompare(b.modelFile.getNamespace()));
    const serverRoot = process.env.SERVER_ROOT;
    const templateResult = nunjucks.render('index.njk', { serverRoot: serverRoot, modelFileIndex: modelFileIndex });
    fs.writeFile( './build/index.html', templateResult, function (err) {
        if (err) {
            return console.log(err);
        }
    });
})();
