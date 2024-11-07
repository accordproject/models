# Model Library Development Guide

Note that all the models in this repository use "imports from http://<URL>" to reference models, which makes each model self-contained. It does mean however that if you introduce a new model and its dependency in the same pull-request then the publish will fail, because the dependency is not yet published. In this scenario
you should re-run the build action (on Github).

## ❗ Accord Project Development Guide ❗
We'd love for you to help develop improvements to Accord Project technology! Please refer to the [Accord Project Development guidelines][apdev] we'd like you to follow.

[apdev]: https://github.com/accordproject/techdocs/blob/master/DEVELOPERS.md