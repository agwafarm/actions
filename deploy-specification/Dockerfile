FROM agwafarm/deploy-specification:v2

RUN npm install -g aws-cdk@2.1021.0

WORKDIR /action

COPY . .

ENTRYPOINT ["/action/entrypoint.sh"]