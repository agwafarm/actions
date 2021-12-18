FROM python:3.8-alpine3.14

# Install packages
RUN apk update \
   && apk add sudo \
   && apk add jq \
   && apk add curl \
   && apk add unzip \ 
   && apk add zip \
   && apk add nodejs \
   && apk add npm

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.30.zip" -o "awscliv2.zip" \
   && unzip -q "awscliv2.zip" \
   && sh ./aws/install \
   && rm awscliv2.zip \
   && rm -rf ./aws/install

# Install cdk
RUN npm i -g aws-cdk@1.94.1

WORKDIR /action

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

ENTRYPOINT ["/action/entrypoint.sh"]