FROM node:14

RUN apt update

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.30.zip" -o "awscliv2.zip"
RUN unzip -q "awscliv2.zip"
RUN sh ./aws/install


RUN apt install -y jq

WORKDIR /action

COPY . .

ENTRYPOINT ["/action/entrypoint.sh"]