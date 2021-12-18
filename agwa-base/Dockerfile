FROM ubuntu:20.04

# Install apt packages
RUN apt update -y \
   && apt install -y software-properties-common \
   && apt install -y sudo \
   && apt install -y jq \
   && apt install -y curl \
   && apt install -y unzip \ 
   && apt install -y zip

# Install Python
RUN add-apt-repository ppa:deadsnakes/ppa \ 
   && apt install -y python3.8 \
   && sudo update-alternatives --install /usr/bin/python python /usr/bin/python3.8 10 \
   && sudo apt install -y python3-pip \
   && python -m pip install pip

# Install Node
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash - \
   && sudo apt-get install -y nodejs

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.30.zip" -o "awscliv2.zip" \
   && unzip -q "awscliv2.zip" \
   && sh ./aws/install

# Install cdk
RUN npm i -g aws-cdk@1.94.1

WORKDIR /action

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

WORKDIR /

ENTRYPOINT ["/action/entrypoint.sh"]