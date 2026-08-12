FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_BI_API_URL
ARG VITE_BI_API_KEY
ENV VITE_BI_API_URL=$VITE_BI_API_URL
ENV VITE_BI_API_KEY=$VITE_BI_API_KEY
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
