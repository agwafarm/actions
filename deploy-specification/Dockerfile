FROM node:14

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.30.zip" -o "awscliv2.zip"
RUN unzip -q "awscliv2.zip"
RUN sh ./aws/install

RUN npm i -g aws-cdk@1.94.1

WORKDIR /action


COPY package-lock.json package.json ./
RUN npm ci

COPY py-prepate.sh ./
RUN ./py-prepare.sh

COPY requirements.txt ./
RUN python3 -m pip install -q -r requirements.txt

COPY . .

WORKDIR /

ENTRYPOINT ["/action/entrypoint.sh"]