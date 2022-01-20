FROM agwafarm/base

WORKDIR /action

COPY package-lock.json package.json ./
RUN npm ci

COPY . .

WORKDIR /

ENTRYPOINT ["/action/entrypoint.sh"]