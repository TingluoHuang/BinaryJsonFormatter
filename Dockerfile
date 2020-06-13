FROM node:12-alpine as build

WORKDIR /app

COPY . /app

RUN npm install --silent
RUN npm install react-scripts@3.4.1 -g --silent
RUN npm run build

FROM nginx:1.18-alpine

COPY --from=build /app/build /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD [ "nginx", "-g", "daemon off;" ]