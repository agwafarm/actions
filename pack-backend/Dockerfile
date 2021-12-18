FROM ubuntu:20.04

# Install apt packages
RUN apt update -y
RUN apt install -y software-properties-common
RUN apt install -y sudo

# Install Utils
RUN apt install -y jq
RUN apt install -y curl
RUN apt install -y unzip
RUN apt install -y zip


# Install Python
RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt install -y python3.8
RUN sudo update-alternatives --install /usr/bin/python python /usr/bin/python3.8 10
RUN sudo apt install -y python3-pip
RUN python -m pip install pip

# Install Node
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
RUN sudo apt-get install -y nodejs

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.30.zip" -o "awscliv2.zip"
RUN unzip -q "awscliv2.zip"
RUN sh ./aws/install

RUN npm i -g aws-cdk@1.94.1

WORKDIR /action

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

WORKDIR /

# ENTRYPOINT ["/action/entrypoint.sh"]