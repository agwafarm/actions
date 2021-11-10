FROM node:14-alpine3.14

WORKDIR /action

RUN npm i -g aws-cdk@1.94.1

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

RUN npm i -g aws-cdk@1.94.1

WORKDIR /

ENTRYPOINT ["/action/entrypoint.sh"]