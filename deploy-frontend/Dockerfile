FROM node:22

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.30.zip" -o "awscliv2.zip"
RUN unzip -q "awscliv2.zip"
RUN sh ./aws/install

RUN apt update -y
RUN apt install -y jq

RUN npm install -g aws-cdk@2.206.0

WORKDIR /action

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

WORKDIR /

ENTRYPOINT ["/action/entrypoint.sh"]