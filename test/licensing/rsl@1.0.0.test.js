/*
 * Copyright 2026 Accord Project contributors.
 *
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

/**
 * Tests for org.accordproject.licensing.rsl@1.0.0, against the normative Relax
 * NG grammar in Appendix A of the RSL 1.0 specification.
 *
 * Everything runs offline: money@1.0.0 resolves from this repository's own src/
 * rather than over the network.
 *
 * Scope, stated plainly: there is no XML adapter here, so nothing below parses
 * or emits RSL XML. What is asserted is that the model's vocabularies are the
 * specification's, that the token spellings a serialiser would produce are the
 * specification's, and that the structural rules Appendix A fixes are fixed
 * here too. A JSON <-> XML round trip belongs with an adapter, wherever one is
 * written.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Factory, ModelManager, Serializer } = require('@accordproject/concerto-core');

const NS = 'org.accordproject.licensing.rsl@1.0.0';
const repoRoot = path.join(__dirname, '..', '..');
const modelFile = (...parts) => path.join(repoRoot, 'src', ...parts);

function modelManager() {
    const manager = new ModelManager();
    // Local, so the import resolves without network access.
    manager.addCTOModel(fs.readFileSync(modelFile('money@1.0.0.cto'), 'utf8'), 'money@1.0.0.cto', true);
    manager.addCTOModel(fs.readFileSync(modelFile('licensing', 'rsl@1.0.0.cto'), 'utf8'), 'rsl@1.0.0.cto', true);
    manager.validateModelFiles();
    return manager;
}

function serializer(manager) {
    return new Serializer(new Factory(manager), manager);
}

/** Enum member names, in declaration order. */
function members(manager, name) {
    return manager.getType(`${NS}.${name}`).getProperties().map((property) => property.getName());
}

/** A Concerto enum member spelled as the RSL token it stands for. */
function token(member) {
    return member.toLowerCase().replace(/_/g, '-');
}

function example() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'rsl-example.json'), 'utf8'));
}

function assertAdapterPaymentChoices(document) {
    for (const content of document.contents) {
        for (const licence of content.licenses) {
            const payment = licence.payment;
            if (!payment) continue;
            if (payment.type !== undefined && payment.typeExtension !== undefined) {
                throw new Error('Payment.type and Payment.typeExtension are mutually exclusive');
            }
            if (payment.amount !== undefined && payment.preciseAmount !== undefined) {
                throw new Error('Payment.amount and Payment.preciseAmount are mutually exclusive');
            }
        }
    }
}

test('the model compiles', () => {
    assert.doesNotThrow(() => modelManager());
});

test('the core usage vocabulary is the specification\'s', () => {
    const usage = members(modelManager(), 'UsageType');
    assert.deepEqual(usage, ['ALL', 'AI_ALL', 'AI_TRAIN', 'AI_INPUT', 'AI_INDEX', 'SEARCH']);
    assert.deepEqual(usage.map(token), ['all', 'ai-all', 'ai-train', 'ai-input', 'ai-index', 'search']);
});

test('the core user vocabulary is the specification\'s', () => {
    const users = members(modelManager(), 'UserType');
    assert.deepEqual(users, ['COMMERCIAL', 'NON_COMMERCIAL', 'EDUCATION', 'GOVERNMENT', 'PERSONAL']);
    assert.deepEqual(users.map(token), ['commercial', 'non-commercial', 'education', 'government', 'personal']);
});

test('the payment, legal and reporting vocabularies are the specification\'s', () => {
    const manager = modelManager();
    assert.deepEqual(members(manager, 'PaymentType').map(token), [
        'purchase', 'subscription', 'training', 'crawl', 'use', 'contribution', 'attribution', 'free',
    ]);
    assert.deepEqual(members(manager, 'WarrantyType').map(token), [
        'ownership', 'authority', 'no-infringement', 'privacy-consent', 'no-malware',
    ]);
    assert.deepEqual(members(manager, 'DisclaimerType').map(token), [
        'as-is', 'no-warranty', 'no-liability', 'no-indemnity',
    ]);
    assert.deepEqual(members(manager, 'ReportingType').map(token), ['telemetry', 'provenance', 'audit']);
    assert.deepEqual(members(manager, 'RightsHolderType').map(token), ['person', 'organization']);
});

test('the example document validates', () => {
    const manager = modelManager();
    const s = serializer(manager);
    assert.doesNotThrow(() => s.toJSON(s.fromJSON(example())));
});

/**
 * Section 3.1.1: all applicable licences are evaluated together and a
 * prohibition always wins, across licences as well as within one. An example
 * that prohibits a usage another of its own licences sells is therefore not
 * expressing what it appears to express.
 */
test('the example never prohibits a usage it also permits', () => {
    const licences = example().contents.flatMap((content) => content.licenses);
    const permitted = new Set(licences.flatMap((licence) => licence.permitsUsage ?? []));
    const prohibited = new Set(licences.flatMap((licence) => licence.prohibitsUsage ?? []));
    const contradiction = [...permitted].filter((usage) => prohibited.has(usage));
    assert.deepEqual(contradiction, [], 'a prohibition in any licence defeats a permit in every other');
});

/**
 * Section 3.3: when `server` is present a client MUST obtain a licence from
 * that OLP server before access, even for a free licence. An example that
 * advertises one imposes a protocol nobody has implemented.
 */
test('the example advertises no licence server it does not implement', () => {
    for (const content of example().contents) {
        assert.equal(content.server, undefined);
    }
});

/**
 * Appendix A: `usageToken = rslUsageToken | qnameToken`, and section 3.4.1 says
 * extension-namespace tokens MAY appear but MUST NOT be interpreted unless the
 * processor recognises them. They must survive rather than be dropped.
 */
test('extension-namespace tokens are carried, not rejected', () => {
    const manager = modelManager();
    const s = serializer(manager);
    const document = {
        $class: `${NS}.RslDocument`,
        contents: [{
            $class: `${NS}.Content`,
            url: '/',
            licenses: [{
                $class: `${NS}.LicenseTerms`,
                permitsUsage: ['SEARCH'],
                permitsUsageExtensions: ['acme:translate'],
                payment: { $class: `${NS}.Payment`, typeExtension: 'acme:metered' },
            }],
        }],
    };
    const round = s.toJSON(s.fromJSON(document));
    assert.deepEqual(round.contents[0].licenses[0].permitsUsageExtensions, ['acme:translate']);
    assert.equal(round.contents[0].licenses[0].payment.typeExtension, 'acme:metered');

    // A bare word is not a QName, and an extension token is not a core token.
    document.contents[0].licenses[0].permitsUsageExtensions = ['translate'];
    assert.throws(() => s.fromJSON(document));
});

/**
 * Appendix A: `license+ & alternate* & schema? & copyright? & terms?`. schema,
 * copyright and terms are at most one each, so they must not be arrays here.
 */
test('schema, copyright and terms are single-valued; licences and alternates are not', () => {
    const content = modelManager().getType(`${NS}.Content`);
    for (const field of ['schema', 'copyright', 'terms']) {
        assert.equal(content.getProperty(field).isArray(), false, `${field} must not be an array`);
    }
    for (const field of ['licenses', 'alternates']) {
        assert.equal(content.getProperty(field).isArray(), true, `${field} must be an array`);
    }
});

/** Appendix A: at most one <permits>/<prohibits> per type value per licence. */
test('permits and prohibits are typed fields, not repeated elements', () => {
    const terms = modelManager().getType(`${NS}.LicenseTerms`);
    for (const field of ['permitsUsage', 'prohibitsUsage']) {
        assert.equal(terms.getProperty(field).getFullyQualifiedTypeName(), `${NS}.UsageType`);
    }
    for (const field of ['permitsUser', 'prohibitsUser']) {
        assert.equal(terms.getProperty(field).getFullyQualifiedTypeName(), `${NS}.UserType`);
    }
});

/**
 * Core <amount> stays ISO 4217. Accord-aware integrations can additionally use
 * the typed preciseAmount foreign extension for an exact non-ISO unit, while
 * <accepts> remains the RSL Core route to the payment protocol.
 */
test('core amount stays ISO while the Accord extension carries exact HBAR', () => {
    const manager = modelManager();
    const s = serializer(manager);
    const amount = manager.getType(`${NS}.Amount`);
    assert.match(amount.getProperty('currency').getFullyQualifiedTypeName(), /CurrencyCode$/);

    const payment = manager.getType(`${NS}.Payment`);
    assert.equal(
        payment.getProperty('preciseAmount').getFullyQualifiedTypeName(),
        'org.accordproject.money@1.0.0.PreciseAmount',
    );

    const hbarPayment = example();
    const preciseAmount = hbarPayment.contents[0].licenses[0].payment.preciseAmount;
    const slip44Registry = JSON.parse(
        fs.readFileSync(path.join(repoRoot, 'data', 'slip44.json'), 'utf8'),
    );
    assert.equal(preciseAmount.unscaledValue, '50000');
    assert.deepEqual(preciseAmount.unit, {
        $class: 'org.accordproject.money@1.0.0.Unit',
        code: 'HBAR',
        scheme: 'slip44',
        identifier: '3030',
        scale: 8,
    });
    assert.deepEqual(preciseAmount.unit, slip44Registry.units.HBAR);
    const protocolMetadata = JSON.parse(
        hbarPayment.contents[0].licenses[0].payment.accepts.metadata,
    );
    assert.deepEqual(protocolMetadata, {
        network: 'hedera:testnet',
        scheme: 'exact',
        asset: '0.0.0',
    });
    assert.notEqual(protocolMetadata.asset, preciseAmount.unit.identifier);
    assert.doesNotThrow(() => s.fromJSON(hbarPayment));

    const invalidCoreAmount = structuredClone(hbarPayment);
    delete invalidCoreAmount.contents[0].licenses[0].payment.preciseAmount;
    invalidCoreAmount.contents[0].licenses[0].payment.amount = {
        $class: `${NS}.Amount`, currency: 'HBAR', value: '1.00',
    };
    assert.throws(() => s.fromJSON(invalidCoreAmount), /currency/);
});

test('adapter payment-choice invariants reject ambiguous values', () => {
    assert.doesNotThrow(() => assertAdapterPaymentChoices(example()));

    const ambiguousType = structuredClone(example());
    ambiguousType.contents[0].licenses[0].payment.typeExtension = 'acme:metered';
    assert.throws(
        () => assertAdapterPaymentChoices(ambiguousType),
        /type and Payment\.typeExtension are mutually exclusive/,
    );

    const ambiguousAmount = structuredClone(example());
    ambiguousAmount.contents[0].licenses[0].payment.amount = {
        $class: `${NS}.Amount`, currency: 'USD', value: '0.01',
    };
    assert.throws(
        () => assertAdapterPaymentChoices(ambiguousAmount),
        /amount and Payment\.preciseAmount are mutually exclusive/,
    );
});

test('the XML exemplar fixes the Accord precise-amount QName and representation', () => {
    const xml = fs.readFileSync(path.join(__dirname, 'data', 'rsl-example.xml'), 'utf8');
    assert.match(xml, /xmlns:accord-money="https:\/\/models\.accordproject\.org\/money@1\.0\.0"/);
    assert.match(xml, /<accord-money:preciseAmount unscaledValue="50000">/);
    assert.match(
        xml,
        /<accord-money:unit code="HBAR" scheme="slip44" identifier="3030" scale="8"\/>/,
    );
    assert.match(xml, /\{"network":"hedera:testnet","scheme":"exact","asset":"0\.0\.0"\}/);
});

/**
 * Appendix A constrains several values that a plain String would not. These are
 * the ones a publisher is most likely to get wrong.
 */
test('constrained values are constrained', () => {
    const manager = modelManager();
    const s = serializer(manager);
    const withReporting = (reporting) => ({
        $class: `${NS}.RslDocument`,
        contents: [{
            $class: `${NS}.Content`,
            url: '/',
            licenses: [{ $class: `${NS}.LicenseTerms`, reporting: [reporting] }],
        }],
    });

    const good = {
        $class: `${NS}.Reporting`,
        type: 'TELEMETRY',
        profile: 'https://contenttelemetry.org/profiles/spur',
        endpoint: 'https://reports.example.com/telemetry',
    };
    assert.doesNotThrow(() => s.fromJSON(withReporting(good)));

    // endpoint must be HTTPS; profile must be an absolute URI.
    assert.throws(() => s.fromJSON(withReporting({ ...good, endpoint: 'http://reports.example.com' })));
    assert.throws(() => s.fromJSON(withReporting({ ...good, profile: '/profiles/spur' })));

    // schema type, where present, must be exactly application/ld+json.
    const withSchema = (type) => ({
        $class: `${NS}.RslDocument`,
        contents: [{
            $class: `${NS}.Content`,
            url: '/',
            licenses: [{ $class: `${NS}.LicenseTerms` }],
            schema: { $class: `${NS}.Schema`, value: '{}', type },
        }],
    });
    assert.doesNotThrow(() => s.fromJSON(withSchema('application/ld+json')));
    assert.throws(() => s.fromJSON(withSchema('application/json')));
});
