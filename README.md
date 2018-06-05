# Accord Project Model Catalog

This repository host all Accord Project models. Models are captured using the <a href="https://hyperledger.github.io/composer/latest/reference/cto_language">Hyperledger Composer modeling language</a>; a platform and runtime neutral typed schema language.

The build system for this repository publishes the models to: https://models.accordproject.org

Environment Variables used by the build system:

- SERVER_ROOT : the root URL for the server. Used when generating absolute hyperlinks.
- FORCE_PUBLISH : disabled the download of external models and model validation. Should be used with care!
