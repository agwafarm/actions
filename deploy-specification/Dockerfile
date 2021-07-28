FROM alpine:3.14.0

WORKDIR /action
COPY . .

ENV PATH="/action/node_modules/.bin:${PATH}"

ENTRYPOINT ["/action/entrypoint.sh"]