FROM node:14-alpine3.14

WORKDIR /action
COPY . .

ENV PATH="/action/node_modules/.bin:${PATH}"

ENTRYPOINT ["/action/entrypoint.sh"]