FROM node:14

WORKDIR /action

RUN npm i -g aws-cdk@1.94.1

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

RUN npm i -g aws-cdk@1.94.1

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.30.zip.sig" -o "awscliv2.zip" && \
   unzip awscliv2.zip && \
   sudo ./aws/install

WORKDIR /

ENTRYPOINT ["/action/entrypoint.sh"]