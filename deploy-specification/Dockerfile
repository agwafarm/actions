FROM agwafarm/base

WORKDIR /action

COPY package-lock.json package.json ./
RUN npm ci

COPY py-prepare.sh ./
RUN ./py-prepare.sh

COPY requirements.txt ./
RUN python3 -m pip install -q -r requirements.txt

COPY . .

WORKDIR /

ENTRYPOINT ["/action/entrypoint.sh"]