Nginx 配置：

```conf
#user  nobody;
worker_processes  1;

#error_log  logs/error.log;
#error_log  logs/error.log  notice;
#error_log  logs/error.log  info;

#pid        logs/nginx.pid;

events {
  worker_connections  1024;
}

http {
  include       mime.types;
  default_type  application/octet-stream;
  sendfile  on;
  keepalive_timeout   65;
  client_max_body_size  100m;  #上传size改为20m，防止文件过大无法上传

  #log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
  #'$status $body_bytes_sent "$http_referer" '
  #'"$http_user_agent" "$http_x_forwarded_for"';
  #access_log  logs/access.log  main;
  #tcp_nopush     on;
  #keepalive_timeout  0;

  gzip  on; #开启 gizp 压缩
  gzip_min_length 1k; #指定启用 Gzip 压缩的最小文件大小。这里表示文件大小至少为 1KB 时才会被压缩。
  gzip_buffers 4 16k; #指定用于压缩的内存缓冲区大小。这里的含义是每个缓冲区大小为 16KB，一共分配 4 个缓冲区。
  gzip_http_version 1.0; #指定启用 Gzip 压缩的 HTTP 协议版本。在这个示例中，仅对 HTTP 1.0 及以上版本的请求启用 Gzip 压缩。
  gzip_comp_level 5;  #指定 Gzip 压缩的压缩级别。级别越高，压缩比越大，但同时也会消耗更多的 CPU 资源。这里的值为 5，表示中等压缩级别。
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;  #指定要进行 Gzip 压缩的 MIME 类型。只有在这些 MIME 类型匹配的响应数据才会被压缩。
  gzip_vary on; #指定是否在响应头中添加 Vary 头。Vary 头的作用是告诉缓存服务器根据不同的请求头来缓存不同的响应，从而避免缓存混乱。这里的值为 on，表示启用 Vary 头。

  server {
    listen       80;
    server_name  localhost;
    #charset koi8-r;
    #access_log  logs/host.access.log  main;
    location / {
      root  /usr/local/nginx/dnhyxc/dist; #设置前端资源包的路径
      index   index.html  index.htm;  #设置前端资源入口html文件
      try_files   $uri  $uri/ /index.html;  #解决 browserRouter 页面刷新后出现404
    }

    location /api/ {
      proxy_set_header  Host  $http_host;
      proxy_set_header  X-Real-IP $remote_addr;
      proxy_set_header  REMOTE-HOST $remote_addr;
      proxy_set_header  X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_pass  http://localhost:9112;
    }

    location /admin/ {
      proxy_set_header  Host  $http_host;
      proxy_set_header  X-Real-IP $remote_addr;
      proxy_set_header  REMOTE-HOST $remote_addr;
      proxy_set_header  X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_pass  http://localhost:9112;
    }

    location /image/ {
      root  /usr/local/server/src/upload/image;
      rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
      proxy_pass  http://localhost:9112;
    }


    location /atlas/ {
      root  /usr/local/server/src/upload/atlas;
      rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
      proxy_pass  http://localhost:9112;
    }

    location /files/ {
      root  /usr/local/server/src/upload/files;
      rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
      proxy_pass  http://localhost:9112;
    }

    #error_page  404  /404.html;
    # redirect server error pages to the static page /50x.html
    #
    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
      root   html;
    }
  # proxy the PHP scripts to Apache listening on 127.0.0.1:80
  #
  #location ~ \.php$ {
  #    proxy_pass   http://127.0.0.1;
  #}
  # pass the PHP scripts to FastCGI server listening on 127.0.0.1:9000
  #
  #location ~ \.php$ {
  #    root           html;
  #    fastcgi_pass   127.0.0.1:9000;
  #    fastcgi_index  index.php;
  #    fastcgi_param  SCRIPT_FILENAME  /scripts$fastcgi_script_name;
  #    include        fastcgi_params;
  #}
  # deny access to .htaccess files, if Apache's document root
  # concurs with nginx's one
  #
  #location ~ /\.ht {
  #    deny  all;
  #}
}

server {
  listen 9002 ssl;
	# listen  9002 ssl;
  server_name  dnhyxc.cn;

  ssl_certificate /usr/local/nginx/certs/dnhyxc.cn_nginx/dnhyxc.cn_bundle.crt;
  ssl_certificate_key /usr/local/nginx/certs/dnhyxc.cn_nginx/dnhyxc.cn.key;

  location / {
    root  /usr/local/nginx/dnhyxc-ai/dist;
    index   index.html  index.htm;
    try_files   $uri  $uri/ /index.html;
  }

  location /api/ {
    proxy_set_header  Host  $http_host;
    proxy_set_header  X-Real-IP $remote_addr;
    proxy_set_header  REMOTE-HOST $remote_addr;
    proxy_set_header  X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header  X-Forwarded-Proto $scheme;  # 添加这一行
    proxy_pass  https://172.17.0.1:9112;
  }

  location /images/ {
    root  /usr/local/server/src/upload/images;
    rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
    proxy_pass  http://172.17.0.1:9112;
  }

  location /files/ {
    root  /usr/local/server/src/upload/files;
    rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
    proxy_pass  http://172.17.0.1:9112;
  }

  error_page  500 502 503 504 /50x.html;
  location = /50x.html {
    root  html;
  }
}

# ---------------- 生产推荐：HTTPS 终止 TLS，固定端口 9112 ----------------
#
# 目标：
# - 让外部访问 `https://dnhyxc.cn:9112/api/...` 命中后端 NestJS 路由
# - TLS 由 Nginx 负责（终止 TLS），后端服务继续跑 HTTP
#
# 端口规划（避免冲突）：
# - Nginx：listen 9112 ssl（对公网）
# - NestJS（pm2）：listen 9113（仅本机/内网 HTTP）
#
# 注意：若后端仍监听 9112，则 Nginx 无法占用 9112；必须把后端端口挪走（例如 9113）。
#
server {
  # 对外 HTTPS 端口：满足 `https://dnhyxc.cn:9112`
  listen 9112 ssl;
  server_name dnhyxc.cn;

  # 证书配置：示例沿用本机证书目录（按实际证书路径调整）
  ssl_certificate /usr/local/nginx/certs/dnhyxc.cn_nginx/dnhyxc.cn_bundle.crt;
  ssl_certificate_key /usr/local/nginx/certs/dnhyxc.cn_nginx/dnhyxc.cn.key;

  # 前端静态资源（可选）：若你不希望 9112 承载前端，可删除该 location，只保留 /api/ 反代
  location / {
    root /usr/local/nginx/dnhyxc-ai/dist;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;
  }

  # 后端 API：/api 前缀与 Nest `app.setGlobalPrefix('api')` 对齐
  location /api/ {
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header REMOTE-HOST $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;

    # SSE/流式接口建议关闭缓冲，避免“卡住不出字”
    proxy_buffering off;
    proxy_cache off;

    # 反代到本机 HTTP 后端（pm2）：务必与 pm2 的 PORT 保持一致
    proxy_pass http://127.0.0.1:9113;
  }
}

server {
  listen  9216;
  server_name  localhost;

  location / {
    root  /usr/local/nginx/html/dist;
    index   index.html  index.htm;
    try_files   $uri  $uri/ /index.html;
  }

  location /api/ {
    proxy_set_header  Host  $http_host;
    proxy_set_header  X-Real-IP $remote_addr;
    proxy_set_header  REMOTE-HOST $remote_addr;
    proxy_set_header  X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass  http://localhost:9112;
  }

  location /image/ {
    root  /usr/local/server/src/upload/image;
    rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
    proxy_pass  http://localhost:9112;
  }

  location /files/ {
    root  /usr/local/server/src/upload/files;
    rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
    proxy_pass  http://localhost:9112;
  }

  error_page  500 502 503 504 /50x.html;
  location = /50x.html {
    root  html;
  }
}

server {
  listen  9116;
  server_name  localhost;

  location / {
    root  /usr/local/nginx/html_web/dist;
    index   index.html  index.htm;
    try_files   $uri  $uri/ /index.html;
  }

  location /api/ {
    proxy_set_header  Host  $http_host;
    proxy_set_header  X-Real-IP $remote_addr;
    proxy_set_header  REMOTE-HOST $remote_addr;
    proxy_set_header  X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass  http://localhost:9112;
  }

  location /image/ {
    root  /usr/local/server/src/upload/image;
    rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
    proxy_pass  http://localhost:9112;
  }

  location /files/ {
    root  /usr/local/server/src/upload/files;
    rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
    proxy_pass  http://localhost:9112;
  }

  error_page  500 502 503 504 /50x.html;
  location = /50x.html {
    root  html;
  }
}

server {
  listen  9612;
  server_name  localhost;
  location / {
    root  /usr/local/nginx/web/dist;
    index   index.html  index.htm;
    try_files   $uri  $uri/ /index.html;
  }

  location /api/ {
    proxy_set_header  Host  $http_host;
    proxy_set_header  X-Real-IP $remote_addr;
    proxy_set_header  REMOTE-HOST $remote_addr;
    proxy_set_header  X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass  http://localhost:9112;
  }

  location /image/ {
    root  /usr/local/server/src/upload/image;
    rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
    proxy_pass  http://localhost:9112;
  }

  location /files/ {
    root  /usr/local/server/src/upload/files;
    rewrite  ^/usr/local/server/src/upload/(.*) /$1 break;
    proxy_pass  http://localhost:9112;
  }

  error_page  500 502 503 504 /50x.html;
  location = /50x.html {
    root  html;
  }
}

server {
    listen  8090;
    server_name  wwww.dnhyxc.cn;

    location / {
      root  /usr/local/nginx/html_admin/dist;
      index   index.html  index.htm;
      try_files   $uri  $uri/ /index.html;
    }

    location /admin/ {
      proxy_set_header  Host  $http_host;
      proxy_set_header  X-Real-IP $remote_addr;
      proxy_set_header  REMOTE-HOST $remote_addr;
      proxy_set_header  X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_pass  http://localhost:9112;
    }
  }
}
```
