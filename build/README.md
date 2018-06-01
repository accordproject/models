# Accord Project Model Catalog

This repository host all Accord Project models. Models are captured using the Hyperledger Composer modeling language; a platform and runtime neutral typed schema language.

Each model file in this repository is designed to be valid standalone, in as much as it can be loaded into a ModelManager and validated. All external dependencies for model files uses explicit `import ... from <url>` imports so that dependencies are loaded from the network at build/validation time.

The build process for this repository takes the model files and publishes them to a static website, along with dynamically generated documentation and diagrams.