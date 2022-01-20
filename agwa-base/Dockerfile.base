FROM python:3.8-alpine3.14
USER root

# Install packages
RUN apk update \
   && apk --no-cache add \
   sudo \
   jq \
   curl \
   bash \
   unzip \ 
   zip \
   nodejs \
   npm \
   binutils \
   build-base

# Install glibc + AWS CLI
ENV GLIBC_VER=2.31-r0
RUN curl -sL https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub -o /etc/apk/keys/sgerrand.rsa.pub \
   && curl -sLO https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VER}/glibc-${GLIBC_VER}.apk \
   && curl -sLO https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VER}/glibc-bin-${GLIBC_VER}.apk \
   && curl -sLO https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VER}/glibc-i18n-${GLIBC_VER}.apk \
   && apk add --no-cache \
   glibc-${GLIBC_VER}.apk \
   glibc-bin-${GLIBC_VER}.apk \
   glibc-i18n-${GLIBC_VER}.apk \
   && /usr/glibc-compat/bin/localedef -i en_US -f UTF-8 en_US.UTF-8 \
   && curl -sL https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.1.30.zip -o awscliv2.zip \
   && unzip awscliv2.zip \
   && aws/install \
   && rm -rf \
   awscliv2.zip \
   aws \
   /usr/local/aws-cli/v2/current/dist/aws_completer \
   /usr/local/aws-cli/v2/current/dist/awscli/data/ac.index \
   /usr/local/aws-cli/v2/current/dist/awscli/examples \
   glibc-*.apk \
   && apk --no-cache del \
   binutils \
   curl \
   && rm -rf /var/cache/apk/*

# Install cdk
RUN npm i -g aws-cdk@1.94.1

# install boto3
RUN pip install boto3==1.20.39

WORKDIR /action

ENTRYPOINT ["/action/entrypoint.sh"]