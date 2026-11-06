# neon1-site

The neon1.tech website. It's a static page in `src/app/public/`, served from a private S3 bucket through CloudFront. The hosting itself lives in [neon1-aws-infrastructure](https://github.com/neon1llc/neon1-aws-infrastructure) under `site/`.

## Check and preview

You need Python 3 and Node.js. Gitleaks is used if it's installed, otherwise the secret scan runs it in Docker.

```bash
make check   # HTML validation, JS syntax, anchors and asset paths, size budget, secret scan
make serve   # http://localhost:8000
```

Run `make help` to list every target.

## Deploy

Pushing to `main` runs the checks and then deploys from GitHub Actions. The workflow assumes an AWS role through OIDC, so the repo holds no AWS keys. The role ARN is the repository variable `AWS_DEPLOY_ROLE_ARN`.

To deploy by hand:

```bash
export AWS_PROFILE=neon1
make deploy invalidate verify
```

`make deploy` compares file hashes with the bucket and syncs only when something differs. Fonts and media are cached for a year and everything else revalidates on each visit, so give a changed font or image a new file name. `make invalidate` clears CloudFront only after a deploy that changed files. Add `FORCE=1` to clear it anyway. `make verify` checks that neon1.tech and www.neon1.tech return the version in the local `index.html`.

`BUCKET`, `DISTRIBUTION` and `VERIFY_URLS` can be overridden on the command line.
