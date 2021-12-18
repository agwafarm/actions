FROM node:14

# Install python
RUN sudo apt-get update -y
RUN sudo apt-get install -y python3.8

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.30.zip" -o "awscliv2.zip"
RUN unzip -q "awscliv2.zip"
RUN sh ./aws/install

RUN apt update -y
RUN apt install -y jq

RUN npm i -g aws-cdk@1.94.1

WORKDIR /action

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

WORKDIR /

ENTRYPOINT ["/action/entrypoint.sh"]