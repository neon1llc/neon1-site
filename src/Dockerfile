
# neon1-site :: optional local preview image (nginx)
FROM node:20-bullseye AS build
WORKDIR /repo
COPY app/ ./app
WORKDIR /repo/app
RUN if [ -f package.json ]; then npm ci && npm run build; else mkdir -p /repo/dist &&     [ -d public ] && cp -R public/* /repo/dist/ || true &&     [ -d src ] && cp -R src/* /repo/dist/ || true &&     [ ! -f /repo/dist/index.html ] && echo '<!doctype html><html><body><h1>neon1</h1></body></html>' > /repo/dist/index.html || true ; fi

FROM nginx:stable
COPY --from=build /repo/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
