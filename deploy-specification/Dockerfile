FROM agwafarm/base

WORKDIR /action

COPY package-lock.json package.json ./
RUN npm ci

COPY requirements.txt py-prepare.sh ./
RUN /action/py-prepare.sh
