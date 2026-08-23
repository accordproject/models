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

const LZString = require('lz-string');

const COMMENT_MARKER = '<!-- concerto-playground-preview -->';
const PLAYGROUND_BASE_URL = 'https://concerto-playground.accordproject.org/';

// Mirrors encodeModelsHash() in accordproject/concerto-playground's App.tsx:
// a single model is stored as a raw CTO string, multiple models as a JSON
// array of CTO strings, both LZ-string compressed for the URL hash.
function encodeModelsHash(sources) {
    const payload = sources.length === 1 ? sources[0] : JSON.stringify(sources);
    return LZString.compressToEncodedURIComponent(payload);
}

function buildPlaygroundUrl({ hash, view, headless }) {
    const params = new URLSearchParams();
    if (headless) {
        params.set('headless', 'true');
    }
    if (view) {
        params.set('view', view);
    }
    const query = params.toString();
    return `${PLAYGROUND_BASE_URL}${query ? `?${query}` : ''}#${hash}`;
}

async function findExistingComment({ github, owner, repo, pull_number }) {
    const comments = await github.paginate(github.rest.issues.listComments, {
        owner,
        repo,
        issue_number: pull_number,
        per_page: 100,
    });
    return comments.find((comment) => comment.body && comment.body.includes(COMMENT_MARKER));
}

async function upsertComment({ github, owner, repo, pull_number, existingComment, body }) {
    if (existingComment) {
        await github.rest.issues.updateComment({
            owner,
            repo,
            comment_id: existingComment.id,
            body,
        });
    } else {
        await github.rest.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body,
        });
    }
}

module.exports = async ({ github, context, core }) => {
    const { owner, repo } = context.repo;
    const pull_number = context.payload.pull_request.number;
    const headSha = context.payload.pull_request.head.sha;

    const changedFiles = await github.paginate(github.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number,
        per_page: 100,
    });

    const ctoFiles = changedFiles.filter(
        (file) => file.filename.endsWith('.cto') && file.status !== 'removed'
    );

    const existingComment = await findExistingComment({ github, owner, repo, pull_number });

    if (ctoFiles.length === 0) {
        core.info('No .cto files changed in this PR; skipping playground preview.');
        if (existingComment) {
            await upsertComment({
                github,
                owner,
                repo,
                pull_number,
                existingComment,
                body: `${COMMENT_MARKER}\n### 🧩 Concerto Playground Preview\n\nNo \`.cto\` model changes in the latest revision of this PR.\n`,
            });
        }
        return;
    }

    const rows = [];
    const sources = [];

    for (const file of ctoFiles) {
        const path = file.filename;
        let content;
        try {
            const { data } = await github.rest.repos.getContent({
                owner,
                repo,
                path,
                ref: headSha,
            });
            content = Buffer.from(data.content, data.encoding).toString('utf8');
        } catch (err) {
            core.warning(`Could not fetch content for ${path}: ${err.message}`);
            continue;
        }

        sources.push(content);

        const hash = encodeModelsHash([content]);
        const diagramUrl = buildPlaygroundUrl({ hash, view: 'diagram', headless: true });
        const codeUrl = buildPlaygroundUrl({ hash, view: 'code', headless: true });
        const editUrl = buildPlaygroundUrl({ hash });

        rows.push(
            `| \`${path}\` | [Diagram](${diagramUrl}) · [Code](${codeUrl}) · [Open in Playground](${editUrl}) |`
        );
    }

    if (rows.length === 0) {
        core.info('No .cto file content could be fetched; skipping playground preview.');
        return;
    }

    let body = `${COMMENT_MARKER}\n### 🧩 Concerto Playground Preview\n\n`;
    body += 'The `.cto` model changes in this PR are pre-loaded into the ';
    body += '[Concerto Playground](https://concerto-playground.accordproject.org) — click a link below for a live preview.\n\n';
    body += '| File | Preview |\n| --- | --- |\n';
    body += `${rows.join('\n')}\n`;

    if (sources.length > 1) {
        const combinedHash = encodeModelsHash(sources);
        const combinedUrl = buildPlaygroundUrl({ hash: combinedHash, view: 'diagram', headless: true });
        body += `\nAll ${sources.length} changed models together: [Preview combined](${combinedUrl})\n`;
    }

    body += `\n<sub>Auto-generated from commit ${headSha.slice(0, 7)}. Updates automatically on new commits.</sub>\n`;

    await upsertComment({ github, owner, repo, pull_number, existingComment, body });
};
