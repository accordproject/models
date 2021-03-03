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

const ModelManager = require('@accordproject/concerto-core').ModelManager;
const concertoVersion = require('@accordproject/concerto-core').version.version;
const ModelFile = require('@accordproject/concerto-core').ModelFile;
const FileWriter = require('@accordproject/concerto-tools').FileWriter;
const CodeGen = require('@accordproject/concerto-tools').CodeGen;
const rimraf = require('rimraf');
const path = require('path');
const nunjucks = require('nunjucks');
const AdmZip = require('adm-zip');
const semver = require('semver');

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
        const fileWriter = new FileWriter(buildDir);
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
        console.log(`Generating PlantUML for ${destPath}/${fileNameNoExt}: ${err.message}`);
    }
}

async function generateTypescript(buildDir, destPath, fileNameNoExt, modelFile) {
    try {
        // generate the Typescript for the ModelFile
        const visitor = new CodeGen.TypescriptVisitor();
        const fileWriter = new FileWriter(buildDir);
        const params = {fileWriter : fileWriter};
        modelFile.accept(visitor, params);
    }
    catch(err) {
        console.log(`Generating Typescript for ${destPath}/${fileNameNoExt}: ${err.message}`);
    }
}

async function generateXmlSchema(buildDir, destPath, fileNameNoExt, modelFile) {
    try {
        // generate the XML Schema for the ModelFile
        const visitor = new CodeGen.XmlSchemaVisitor();
        const fileWriter = new FileWriter(buildDir);

        const zip = new AdmZip();
            
        // override closeFile to aggregate all the files into a single zip
        fileWriter.closeFile = function() {
            if (!this.fileName) {
                throw new Error('No file open');
            }
    
            // add file to zip
            const content = fileWriter.getBuffer();
            zip.addFile(this.fileName, Buffer.alloc(content.length, content), `Generated from ${modelFile.getName()}`);
            zip.writeZip(`${destPath}/${fileNameNoExt}.xsd.zip`);

            this.fileName = null;
            this.relativeDir = null;
            this.clearBuffer();
        };
        const params = {fileWriter : fileWriter};
        modelFile.getModelManager().accept(visitor, params);
    }
    catch(err) {
        console.log(`Generating XmlSchema for ${destPath}/${fileNameNoExt}: ${err.message}`);
    }
}

async function generateJsonSchema(buildDir, destPath, fileNameNoExt, modelFile) {
    try {
            // generate the JSON Schema
            const visitor = new CodeGen.JSONSchemaVisitor();
            const params = {};
            const jsonSchemas = modelFile.getModelManager().accept(visitor, params);
            const generatedJsonFile = `${destPath}/${fileNameNoExt}.json`;
            // save JSON Schema
            fs.writeFile( `${generatedJsonFile}`, JSON.stringify(jsonSchemas), function (err) {
                if (err) {
                    return console.log(err);
                }
            });
    }
    catch(err) {
        console.log(`Generating JsonSchema for ${destPath}/${fileNameNoExt}: ${err.message}`);
    }
}

async function generateJava(buildDir, destPath, fileNameNoExt, modelFile) {
    try {
            // generate the Java for the ModelFile
            const visitor = new CodeGen.JavaVisitor();
            const fileWriter = new FileWriter(buildDir);
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
        console.log(`Generating Java for ${destPath}/${fileNameNoExt}: ${err.message}`);
    }
}

async function generateGo(buildDir, destPath, fileNameNoExt, modelFile) {
    try {
            // generate the Go Lang for the ModelFile
            const visitor = new CodeGen.GoLangVisitor();
            const fileWriter = new FileWriter(buildDir);
            const zip = new AdmZip();
            
            // override closeFile to aggregate all the files into a single zip
            fileWriter.closeFile = function() {
                if (!this.fileName) {
                    throw new Error('No file open');
                }
        
                // add file to zip
                const content = fileWriter.getBuffer();
                zip.addFile(this.fileName, Buffer.alloc(content.length, content), `Generated from ${modelFile.getName()}`);
                zip.writeZip(`${destPath}/${fileNameNoExt}.go.zip`);

                this.fileName = null;
                this.relativeDir = null;
                this.clearBuffer();
            };
            const params = {fileWriter : fileWriter};
            modelFile.getModelManager().accept(visitor, params);
    }
    catch(err) {
        console.log(`Generating Go for ${destPath}/${fileNameNoExt}: ${err.message}`);
    }
}

const rootDir = resolve(__dirname, './src');
const buildDir = resolve(__dirname, './build');
let modelFileIndex = [];

/**
 * Returns true if the Concerto model is compatible with the version of concerto core being used
 * based on a comment like: // requires: concerto-core:0.82
 * @param {string} concertoVersion the current version of concerto-core, listed in package.json
 * @param {*} modelText the CTO model text
 */
function isCompatible(concertoVersion, modelText) {
    const regex = /^\/\/.*requires:.*concerto-core:(?<versionRange>.*)$/m;
    const match = modelText.match(regex);
    const versionRange = match ? match.groups.versionRange : null;
    return versionRange ? semver.satisfies( concertoVersion, versionRange ) : true;
}

(async function () {

    // delete build directory
    rimraf.sync(buildDir);

    nunjucks.configure('./views', { autoescape: true });
    
    // copy the logo to build directory
    await fs.copy('assets', './build/assets');
    await fs.copy('styles.css', './build/styles.css');
    await fs.copy('fonts.css', './build/fonts.css');
    await fs.copy('_headers', './build/_headers');

    // validate and copy all the files
    const files = await getFiles(rootDir);
    for( const file of files ) {
        const modelText = fs.readFileSync(file, 'utf8');
        
        // skip if this CTO file is not compatible with the current runtime
        if( isCompatible(concertoVersion, modelText) ) {
            const modelManager = new ModelManager();
            if(semver.satisfies(concertoVersion, '0.82.x')) {
                // load system model if we are using 0.82
                const systemModel = fs.readFileSync(rootDir + '/cicero/base.cto', 'utf8');
                modelManager.addModelFile(systemModel, 'base.cto', false, true);
            }
            const modelFile  = new ModelFile(modelManager, modelText, file);     
            console.log(`Processing ${modelFile.getNamespace()}`);
            let modelFilePlantUML = '';
            // passed validation, so copy to build dir
            const dest = file.replace('/src/', '/build/');
            const destPath = path.dirname(dest);
            const relative = destPath.slice(buildDir.length);
            
            const fileName = path.basename(file);
            const fileNameNoExt = path.parse(fileName).name;
    
            await fs.ensureDir(destPath);
            let umlURL = '';
            try {
                // Find the model version
                const modelVersionStr = relative.match(/v\d+(\.\d+){0,2}/g);
                const isLegacyModelVersionScheme = modelVersionStr !== null && modelVersionStr.length === 1;
                if (!isLegacyModelVersionScheme) { // Skip indexing models with the old versioning scheme, they have all been migrated now
                    const semverStr = modelFile.getName().split("@").pop().slice(0,-4);
                    const isSemverVersionScheme = semver.valid(semverStr);
                    const modelVersion = isSemverVersionScheme ? `(${semverStr})` : '(0.1.0)';
    
                    modelManager.addModelFile(modelFile, modelFile.getName(), true);
    
                    // use the FORCE_PUBLISH flag to disable download of
                    // external models and model validation
                    if(!process.env.FORCE_PUBLISH) {
                        await modelManager.updateExternalModels();
                    }
    
                    umlURL = await generatePlantUML(buildDir, destPath, fileNameNoExt, modelFile);
                    await generateTypescript(buildDir, destPath, fileNameNoExt, modelFile);
                    await generateXmlSchema(buildDir, destPath, fileNameNoExt, modelFile);
                    await generateJsonSchema(buildDir, destPath, fileNameNoExt, modelFile);
                    await generateJava(buildDir, destPath, fileNameNoExt, modelFile);
                    await generateGo(buildDir, destPath, fileNameNoExt, modelFile);
                    
                    // copy the CTO file to the build dir
                    await fs.copy(file, dest);
    
                    // generate the html page for the model
                    const generatedHtmlFile = `${relative}/${fileNameNoExt}.html`;
                    const serverRoot = process.env.SERVER_ROOT;
                    const templateResult = nunjucks.render('model.njk', { serverRoot: serverRoot, modelFile: modelFile, modelVersion: modelVersion, filePath: `${relative}/${fileNameNoExt}`, umlURL: umlURL });
                    modelFileIndex.push({htmlFile: generatedHtmlFile, modelFile: modelFile, modelVersion: modelVersion});
                    console.log(`✓ Processed ${modelFile.getNamespace()} (${modelVersion})`);
    
                    fs.writeFile( `./build/${generatedHtmlFile}`, templateResult, function (err) {
                        if (err) {
                            return console.log(err);
                        }
                    });
                } else {
                    // copy the CTO file to the build dir
                    await fs.copy(file, dest);
                }
            } catch (err) {
                console.log(`❗ Error handling ${modelFile.getName()}`);
                console.log(err.message);
            }
        }
        else {
            console.log(`✋ Skipped ${file} due to incompatability.`);
        }
    }; // for

    // generate the index html page
    modelFileIndex = modelFileIndex.sort((a, b) => a.modelFile.getNamespace().localeCompare(b.modelFile.getNamespace()));
    const serverRoot = process.env.SERVER_ROOT;
    const templateResult = nunjucks.render('index.njk', { serverRoot: serverRoot, modelFileIndex: modelFileIndex });
    fs.writeFile( './build/index.html', templateResult, function (err) {
        if (err) {
            return console.log(err);
        }
    });
}
)();
