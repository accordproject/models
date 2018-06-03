# Accord Project Model Catalog

This repository host all Accord Project models. Models are captured using the <a href="https://hyperledger.github.io/composer/latest/reference/cto_language">Hyperledger Composer modeling language</a>; a platform and runtime neutral typed schema language.

Each model file in this repository is designed to be valid standalone, in as much as it can be loaded into a ModelManager and validated, or imported for use in a Cicero template. All external dependencies for model files uses explicit `import ... from <url>` imports so that dependencies are loaded from the network at build/validation time.

## Models
