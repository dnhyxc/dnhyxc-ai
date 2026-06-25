# Arco Design React 组件库——快速上手完全指南

> Arco Design 是字节跳动出品的企业级设计系统，提供开箱即用的高质量 React 组件。本文从零开始，手把手带你完成安装、配置、基础使用、主题定制、暗黑模式、国际化等全部核心内容。

---

## 一、环境要求

| 依赖 | 版本要求 |
|------|----------|
| React | >= 16.8 |
| React DOM | >= 16.8 |
| Node.js | >= 12.x |
| IE 浏览器 | **不支持**（基于 CSS Custom Properties） |

> 如果需要兼容 IE 浏览器，可以使用 [postcss-custom-properties](https://github.com/postcss/postcss-custom-properties) 插件将 CSS 变量转换回静态值。

---

## 二、安装

### 2.1 npm 安装（推荐）

```bash
# npm
npm i @arco-design/web-react

# yarn
yarn add @arco-design/web-react

# pnpm
pnpm add @arco-design/web-react
```

### 2.2 CDN 引入（不推荐）

CDN 会引入全量组件代码，影响页面加载速度。仅在快速演示或无法使用 npm 时考虑。

```html
<!-- 开发环境 -->
<script src="https://unpkg.com/@arco-design/web-react@latest/dist/arco.development.js"></script>
<link href="https://unpkg.com/@arco-design/web-react@latest/dist/css/arco.min.css" rel="stylesheet">

<!-- 生产环境 -->
<script src="https://unpkg.com/@arco-design/web-react@latest/dist/arco.min.js"></script>
<link href="https://unpkg.com/@arco-design/web-react@latest/dist/css/arco.min.css" rel="stylesheet">
```

---

## 三、基础使用

### 3.1 最简示例

安装完成后，在入口文件引入样式文件和组件即可使用。

```jsx
// main.jsx（React 18）
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from '@arco-design/web-react';
import '@arco-design/web-react/dist/css/arco.css';

const root = ReactDOM.createRoot(document.querySelector('#root'));
root.render(<Button type="primary">Hello Arco</Button>);
```

```jsx
// main.jsx（React 17 及之前）
import React from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@arco-design/web-react';
import '@arco-design/web-react/dist/css/arco.css';

ReactDOM.render(
  <Button type="primary">Hello Arco</Button>,
  document.querySelector('#root')
);
```

### 3.2 兼容 React 19

如果项目使用 React 19，需要在入口文件顶部引入适配器：

```jsx
// 一定要放在最顶部
import '@arco-design/web-react/es/_util/react-19-adapter';

import React from 'react';
import { Button } from '@arco-design/web-react';
import '@arco-design/web-react/dist/css/arco.css';

ReactDOM.createRoot(document.querySelector('#root')).render(
  <Button type="primary">Hello Arco</Button>
);
```

---

## 四、按需加载

Arco Design 支持 **tree shaking**，默认导入方式即支持按需加载。如果遇到 tree shaking 失效，或者需要手动控制样式和图标的按需加载，有两种方案。

### 方案一：使用官方插件（推荐）

Arco 官方提供了一系列插件，支持组件、样式、图标的按需加载。

#### 插件列表

| 插件 | 适用场景 |
|------|----------|
| [@arco-plugins/unplugin-react](https://github.com/arco-design/arco-plugins/blob/main/packages/unplugin-react/README.zh-CN.md) | Rspack / Vite / Webpack / Rollup 等 |
| [@arco-plugins/webpack-react](https://github.com/arco-design/arco-plugins/blob/main/packages/plugin-webpack-react/README.zh-CN.md) | Webpack |
| [@arco-plugins/vite-react](https://github.com/arco-design/arco-plugins/blob/main/packages/plugin-vite-react/README.zh-CN.md) | Vite |

#### Vite 项目接入（最常用）

```bash
npm i @arco-plugins/vite-react -D
```

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import AutoImport from '@arco-plugins/vite-react';

export default defineConfig({
  plugins: [
    react(),
    AutoImport({
      // 组件样式按需加载
      style: true,
      // 组件图标按需加载
      icon: true,
    }),
  ],
});
```

接入后，可以直接写全量导入，插件会自动处理按需加载：

```jsx
// 无需手动按需导入，插件自动处理
import { Button, Input, Select } from '@arco-design/web-react';
```

#### Webpack 项目接入

```bash
npm i @arco-plugins/webpack-react -D
```

```js
// webpack.config.js
const ArcoWebpackPlugin = require('@arco-plugins/webpack-react');

module.exports = {
  plugins: [
    new ArcoWebpackPlugin({
      style: true,  // 组件样式按需加载
      icon: true,    // 组件图标按需加载
    }),
  ],
};
```

#### Rspack 项目接入

```bash
npm i @arco-plugins/unplugin-react -D
```

```js
// rspack.config.js
const { defineConfig } = require('@rspack/cli');
const AutoImport = require('@arco-plugins/unplugin-react');

module.exports = defineConfig({
  plugins: [
    AutoImport({
      style: true,
      icon: true,
    }),
  ],
});
```

### 方案二：使用 babel-plugin-import

如果不想引入额外插件，可以使用 babel-plugin-import 实现按需加载。

#### 安装

```bash
npm i babel-plugin-import -D
```

#### Babel 配置（.babelrc 或 babel.config.js）

```js
// babel.config.js
module.exports = {
  plugins: [
    // 组件和样式按需加载
    [
      'babel-plugin-import',
      {
        libraryName: '@arco-design/web-react',
        libraryDirectory: 'es',
        camel2DashComponentName: false,
        style: true,  // 样式按需加载
      },
    ],

    // 图标按需加载
    [
      'babel-plugin-import',
      {
        libraryName: '@arco-design/web-react/icon',
        libraryDirectory: 'react-icon',
        camel2DashComponentName: false,
      },
    ],
  ],
};
```

#### 使用示例

配置完成后，直接写全量导入，babel 会在编译时自动转换为按需导入：

```jsx
// 实际写代码时
import { Button, Input } from '@arco-design/web-react';
import { IconHome, IconSettings } from '@arco-design/web-react/icon';

// babel-plugin-import 编译后等价于（自动转换）：
// import Button from '@arco-design/web-react/es/Button';
// import Input from '@arco-design/web-react/es/Input';
// import { IconHome } from '@arco-design/web-react/es/icon';
```

---

## 五、常用组件示例

下面列举 Arco Design 中最常用的组件及代码示例。

### 5.1 Button（按钮）

```jsx
import { Button, Space } from '@arco-design/web-react';

function App() {
  return (
    <Space direction="vertical" size="large">
      {/* 四种类型 */}
      <Space>
        <Button type="primary">Primary</Button>
        <Button type="secondary">Secondary</Button>
        <Button type="dashed">Dashed</Button>
        <Button>Default</Button>
      </Space>

      {/* 四种状态 */}
      <Space>
        <Button status="warning">Warning</Button>
        <Button status="success">Success</Button>
        <Button status="danger">Danger</Button>
      </Space>

      {/* 三种尺寸 */}
      <Space>
        <Button size="mini">Mini</Button>
        <Button size="small">Small</Button>
        <Button size="default">Default</Button>
        <Button size="large">Large</Button>
      </Space>

      {/* 图标按钮 */}
      <Space>
        <Button type="primary" icon={<IconHome />}>首页</Button>
        <Button type="primary" icon={<IconHome />} />
      </Space>

      {/* 禁用状态 */}
      <Button disabled>Disabled</Button>

      {/* 加载状态 */}
      <Button type="primary" loading>Loading</Button>
    </Space>
  );
}
```

### 5.2 Input（输入框）

```jsx
import { Input, InputNumber, Space } from '@arco-design/web-react';

function App() {
  return (
    <Space direction="vertical" size="large">
      {/* 基础输入框 */}
      <Input placeholder="请输入内容" />

      {/* 带前缀/后缀 */}
      <Input
        placeholder="请输入用户名"
        prefix={<IconUser />}
      />
      <Input
        placeholder="请输入金额"
        suffix={<span>元</span>}
      />

      {/* 带清空按钮 */}
      <Input
        placeholder="可清空"
        allowClear
        defaultValue="初始值"
      />

      {/* 数字输入框 */}
      <InputNumber
        min={0}
        max={100}
        step={1}
        defaultValue={10}
        placeholder="请输入数字"
      />

      {/* 搜索框 */}
      <Input.Search
        placeholder="搜索内容"
        onSearch={(value) => console.log(value)}
      />
    </Space>
  );
}
```

### 5.3 Select（下拉选择）

```jsx
import { Select, Space } from '@arco-design/web-react';

const options = [
  { label: '选项一', value: 1 },
  { label: '选项二', value: 2 },
  { label: '选项三', value: 3, disabled: true },
];

function App() {
  return (
    <Space direction="vertical" size="large">
      {/* 基础单选 */}
      <Select
        placeholder="请选择"
        options={options}
        style={{ width: 200 }}
      />

      {/* 多选 */}
      <Select
        mode="multiple"
        placeholder="可多选"
        options={options}
        style={{ width: 300 }}
      />

      {/* 带搜索 */}
      <Select
        showSearch
        placeholder="搜索选择"
        options={options}
        filterOption={(inputValue, option) =>
          option.label.props.children
            .toLowerCase()
            .includes(inputValue.toLowerCase())
        }
      />

      {/* 创建新选项 */}
      <Select
        allowCreate
        mode="multiple"
        placeholder="可创建新选项"
        options={options}
      />
    </Space>
  );
}
```

### 5.4 Table（表格）

```jsx
import { Table, Tag, Space, Button } from '@arco-design/web-react';

const columns = [
  {
    title: '姓名',
    dataIndex: 'name',
  },
  {
    title: '年龄',
    dataIndex: 'age',
    sorter: (a, b) => a.age - b.age,
  },
  {
    title: '状态',
    dataIndex: 'status',
    render: (status) => (
      <Tag color={status === 'active' ? 'green' : 'red'}>
        {status === 'active' ? '正常' : '禁用'}
      </Tag>
    ),
  },
  {
    title: '操作',
    render: (_, record) => (
      <Space>
        <Button type="text" size="small">编辑</Button>
        <Button type="text" size="small" status="danger">删除</Button>
      </Space>
    ),
  },
];

const data = [
  { key: '1', name: '张三', age: 25, status: 'active' },
  { key: '2', name: '李四', age: 30, status: 'disabled' },
  { key: '3', name: '王五', age: 28, status: 'active' },
];

function App() {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  return (
    <Table
      columns={columns}
      data={data}
      rowSelection={{
        type: 'checkbox',
        selectedRowKeys,
        onChange: (selectedRowKeys) => setSelectedRowKeys(selectedRowKeys),
      }}
      pagination={{
        pageSize: 10,
        showTotal: true,
        showJumper: true,
      }}
    />
  );
}
```

### 5.5 Modal（对话框）

```jsx
import { Modal, Button, Space, Message } from '@arco-design/web-react';
import { useState } from 'react';

function App() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button type="primary" onClick={() => setVisible(true)}>
        打开弹窗
      </Button>

      <Modal
        title="确认操作"
        visible={visible}
        onOk={() => {
          Message.success('操作成功');
          setVisible(false);
        }}
        onCancel={() => setVisible(false)}
        unmountOnExit
      >
        <p>确定要执行此操作吗？</p>
      </Modal>
    </>
  );
}
```

### 5.6 Message / Notification（消息通知）

```jsx
import { Message, Notification, Button, Space } from '@arco-design/web-react';

function App() {
  return (
    <Space>
      {/* Message 轻量提示 */}
      <Button
        type="primary"
        onClick={() => Message.success('保存成功')}
      >
        成功提示
      </Button>
      <Button
        status="warning"
        onClick={() => Message.warning('操作有风险')}
      >
        警告提示
      </Button>
      <Button
        status="danger"
        onClick={() => Message.error('请求失败')}
      >
        错误提示
      </Button>

      {/* Notification 通知提醒 */}
      <Button
        onClick={() =>
          Notification.info({
            title: '新消息',
            content: '您有一条新的通知',
            duration: 3000,
          })
        }
      >
        通知提醒
      </Button>
    </Space>
  );
}
```

### 5.7 Form（表单）

```jsx
import { Form, Input, Select, Button, Space, Message } from '@arco-design/web-react';

function App() {
  const [form] = Form.useForm();

  return (
    <Form
      form={form}
      layout="vertical"
      onSubmit={(values) => {
        Message.success(`提交成功: ${JSON.stringify(values)}`);
      }}
    >
      <Form.Item label="用户名" field="username" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input placeholder="请输入用户名" />
      </Form.Item>

      <Form.Item label="邮箱" field="email" rules={[
        { required: true, message: '请输入邮箱' },
        { type: 'email', message: '邮箱格式不正确' },
      ]}>
        <Input placeholder="请输入邮箱" />
      </Form.Item>

      <Form.Item label="部门" field="department">
        <Select
          placeholder="请选择部门"
          options={[
            { label: '技术部', value: 'tech' },
            { label: '产品部', value: 'product' },
            { label: '设计部', value: 'design' },
          ]}
        />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">提交</Button>
          <Button
            onClick={() => {
              form.resetFields();
            }}
          >
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
```

### 5.8 DatePicker（日期选择器）

```jsx
import { DatePicker, Space } from '@arco-design/web-react';

function App() {
  return (
    <Space direction="vertical" size="large">
      {/* 日期选择 */}
      <DatePicker placeholder="选择日期" />

      {/* 日期范围选择 */}
      <DatePicker.RangePicker placeholder={['开始日期', '结束日期']} />

      {/* 周选择 */}
      <DatePicker.WeekPicker placeholder="选择周" />

      {/* 月份选择 */}
      <DatePicker.MonthPicker placeholder="选择月份" />

      {/* 快捷日期 */}
      <DatePicker
        showTime
        placeholder="选择日期时间"
        shortcuts={[
          { text: '今天', value: () => dayjs() },
          { text: '一周后', value: () => dayjs().add(7, 'day') },
        ]}
      />
    </Space>
  );
}
```

### 5.9 Tabs（标签页）

```jsx
import { Tabs, Button, Space } from '@arco-design/web-react';

function App() {
  const [activeTab, setActiveTab] = useState('1');

  return (
    <Tabs
      activeTab={activeTab}
      onChange={setActiveTab}
      type="rounded"
    >
      <Tabs.TabPane key="1" title="用户管理">
        <p>用户管理内容区域</p>
      </Tabs.TabPane>

      <Tabs.TabPane key="2" title="权限配置">
        <p>权限配置内容区域</p>
      </Tabs.TabPane>

      <Tabs.TabPane key="3" title="操作日志">
        <p>操作日志内容区域</p>
      </Tabs.TabPane>
    </Tabs>
  );
}
```

### 5.10 Pagination（分页）

```jsx
import { Pagination, Space } from '@arco-design/web-react';

function App() {
  return (
    <Space direction="vertical" size="large">
      {/* 基础分页 */}
      <Pagination total={200} showTotal showJumper />

      {/* 简洁模式 */}
      <Pagination total={200} simple />

      {/* 显示总数 */}
      <Pagination
        total={500}
        showTotal={(total, range) => `${range[0]}-${range[1]} 共 ${total} 条`}
      />
    </Space>
  );
}
```

---

## 六、主题定制

### 6.1 通过 Less 变量覆盖定制

Arco Design 基于 Less 构建，通过 `less-loader` 的 `modifyVars` 可以覆盖变量来定制主题。

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.less$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                modifyVars: {
                  // 修改主色调为红色
                  'arcoblue-6': '#f85959',
                  // 修改圆角
                  'border-radius-base': '4px',
                  // 修改成功色
                  'color-success-6': '#00b42a',
                },
                javascriptEnabled: true,
              },
            },
          },
        ],
      },
    ],
  },
};
```

### 6.2 通过 ConfigProvider 局部定制

如果只想修改某个组件的主题，可以通过 `ConfigProvider` 包裹实现。

```jsx
import { ConfigProvider, Button } from '@arco-design/web-react';

function App() {
  return (
    <ConfigProvider
      theme={{
        // 组件级别的主题覆盖
        components: {
          Button: {
            colorPrimary: '#f85959',
            borderRadiusBase: 4,
          },
        },
      }}
    >
      <Button type="primary">自定义主题按钮</Button>
    </ConfigProvider>
  );
}
```

### 6.3 全局 CSS 变量覆盖

组件库内部使用了 CSS 变量，可以直接在 CSS 中覆盖。

```css
/* 自定义主题色 */
:root {
  --arcoblue-6: #f85959;
}

/* 自定义圆角 */
:root {
  --border-radius-base: 4px;
}

/* 自定义边框颜色 */
:root {
  --color-border: #e5e6eb;
}
```

---

## 七、暗黑模式

### 7.1 切换暗黑模式

通过给 `body` 标签设置 `arco-theme` 属性来切换主题。

```jsx
import { Button, Space } from '@arco-design/web-react';

function App() {
  const toggleDark = () => {
    const isDark = document.body.getAttribute('arco-theme') === 'dark';
    if (isDark) {
      document.body.removeAttribute('arco-theme');
    } else {
      document.body.setAttribute('arco-theme', 'dark');
    }
  };

  return (
    <Space>
      <Button type="primary" onClick={toggleDark}>
        切换暗黑模式
      </Button>
    </Space>
  );
}
```

### 7.2 跟随系统主题自动切换

```jsx
// 在入口文件或 App 组件中执行一次即可
function setupDarkMode() {
  const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = (e) => {
    if (e.matches) {
      document.body.setAttribute('arco-theme', 'dark');
    } else {
      document.body.removeAttribute('arco-theme');
    }
  };

  // 初始执行一次
  handleChange(darkThemeMq);

  // 监听系统主题变化
  darkThemeMq.addEventListener('change', handleChange);
}

setupDarkMode();
```

### 7.3 调整页面整体背景配合暗黑模式

组件库切换到暗黑模式后，页面本身的背景和文字颜色也需要同步调整。

```css
/* 配合暗黑模式调整页面整体风格 */
body[arco-theme="dark"] {
  background-color: var(--color-bg-1);
  color: var(--color-text-1);
  color-scheme: dark; /* 滚动条等也会变为暗色 */
}
```

### 7.4 暗黑模式常用 CSS 变量

| 变量 | 用途 | 亮色值 | 暗色值 |
|------|------|--------|--------|
| `--color-bg-1` | 整体背景 | #fff | #17171A |
| `--color-bg-2` | 一级容器背景 | #fff | #232324 |
| `--color-bg-3` | 二级容器背景 | #fff | #2a2a2b |
| `--color-bg-4` | 三级容器背景 | #fff | #313132 |
| `--color-text-1` | 标题文字 | #1d2129 | rgba(255,255,255,0.9) |
| `--color-text-2` | 正文文字 | #4e5969 | rgba(255,255,255,0.7) |
| `--color-text-3` | 次要文字 | #86909c | rgba(255,255,255,0.5) |
| `--color-text-4` | 禁用文字 | #c9cdd4 | rgba(255,255,255,0.3) |

---

## 八、国际化

### 8.1 基本用法

通过 `ConfigProvider` 设置语言。

```jsx
import { ConfigProvider, Button, Space } from '@arco-design/web-react';
import enUS from '@arco-design/web-react/es/locale/en-US';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      {/* 组件文案会显示中文 */}
      <YourApp />
    </ConfigProvider>
  );
}
```

### 8.2 支持的语言

| 语言 | 语言编码 | 备注 |
|------|----------|------|
| 简体中文 | zh-CN | 默认 |
| 英语 | en-US | - |
| 日语 | ja-JP | - |
| 韩语 | ko-KR | - |
| 印尼语 | id-ID | - |
| 泰语 | th-TH | - |
| 繁体中文（港） | zh-HK | - |
| 繁体中文（台） | zh-TW | - |
| 法语（法国） | fr-FR | v2.28.0+ |
| 德语（德国） | de-DE | v2.28.0+ |
| 意大利语 | it-IT | v2.28.0+ |
| 西班牙语 | es-ES | v2.28.0+ |
| 越南语 | vi-VN | v2.33.0+ |
| 阿拉伯语（埃及） | ar-EG | v2.34.0+ |

### 8.3 动态切换语言

```jsx
import { ConfigProvider, Select, Space } from '@arco-design/web-react';
import enUS from '@arco-design/web-react/es/locale/en-US';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
import jaJP from '@arco-design/web-react/es/locale/ja-JP';

const LOCALES = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
};

function App() {
  const [locale, setLocale] = useState(zhCN);

  return (
    <ConfigProvider locale={locale}>
      <Space>
        <Select
          value={Object.keys(LOCALES).find((k) => LOCALES[k] === locale)}
          onChange={(value) => setLocale(LOCALES[value])}
          options={[
            { label: '简体中文', value: 'zh-CN' },
            { label: 'English', value: 'en-US' },
            { label: '日本語', value: 'ja-JP' },
          ]}
          style={{ width: 120 }}
        />
      </Space>
      {/* 组件内的分页、提示等文案会自动切换 */}
      <YourApp />
    </ConfigProvider>
  );
}
```

---

## 九、完整项目模板

### 9.1 React + Vite 项目接入 Arco Design

**步骤 1：创建项目**

```bash
npm create vite@latest my-app -- --template react
cd my-app
npm install
```

**步骤 2：安装 Arco Design**

```bash
npm i @arco-design/web-react
npm i @arco-plugins/vite-react -D
```

**步骤 3：配置 Vite**

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import AutoImport from '@arco-plugins/vite-react';

export default defineConfig({
  plugins: [
    react(),
    AutoImport({
      style: true,
      icon: true,
    }),
  ],
});
```

**步骤 4：入口文件**

```jsx
// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.querySelector('#root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**步骤 5：使用组件**

```jsx
// App.jsx
import { Button, Input, Table, Space, Message } from '@arco-design/web-react';

function App() {
  return (
    <Space direction="vertical" style={{ padding: 20 }}>
      <Input.Search
        placeholder="搜索..."
        onSearch={(value) => Message.info(`搜索: ${value}`)}
        style={{ width: 300 }}
      />
      <Button type="primary" onClick={() => Message.success('点击成功')}>
        提交
      </Button>
    </Space>
  );
}

export default App;
```

### 9.2 React + Webpack 项目接入 Arco Design

**步骤 1：安装依赖**

```bash
npm i @arco-design/web-react
npm i @arco-plugins/webpack-react -D
```

**步骤 2：配置 Webpack**

```js
// webpack.config.js
const ArcoWebpackPlugin = require('@arco-plugins/webpack-react');
const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new ArcoWebpackPlugin({
      style: true,
      icon: true,
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};
```

### 9.3 React + Rspack 项目接入 Arco Design

**步骤 1：安装依赖**

```bash
npm i @arco-design/web-react
npm i @arco-plugins/unplugin-react -D
```

**步骤 2：配置 Rspack**

```js
// rspack.config.js
const { defineConfig } = require('@rspack/cli');
const AutoImport = require('@arco-plugins/unplugin-react');

module.exports = defineConfig({
  entry: {
    index: './src/index.jsx',
  },
  output: {
    path: './dist',
    filename: '[name].[contenthash].js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: 'builtin:swc-loader',
      },
    ],
  },
  plugins: [
    AutoImport({
      style: true,
      icon: true,
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
});
```

---

## 十、常见问题

### Q1：按需加载失效怎么办？

**排查步骤：**

1. 确认是否正确安装了按需加载插件（unplugin-react / vite-react / webpack-react）
2. 确认插件配置正确放入 `plugins` 数组中
3. 确认项目重新启动（重启 dev server 或重新 build）
4. 检查编译后的代码是否仍为全量导入

### Q2：样式不生效？

1. 确认已引入样式文件：`import '@arco-design/web-react/dist/css/arco.css'`
2. 如果使用按需加载插件且 `style: true`，则不需要手动引入 CSS 文件
3. 检查 CSS 文件路径是否正确

### Q3：React 19 兼容性问题？

在入口文件顶部添加适配器：

```jsx
import '@arco-design/web-react/es/_util/react-19-adapter';
```

### Q4：暗黑模式下自定义组件不生效？

需要为自定义组件也添加对应的 CSS 变量适配：

```css
/* 亮色模式 */
.custom-component {
  background-color: #fff;
  color: #1d2129;
}

/* 暗黑模式 */
body[arco-theme="dark"] .custom-component {
  background-color: #232324;
  color: rgba(255, 255, 255, 0.9);
}
```

### Q5：如何在单个页面禁用暗黑模式？

```jsx
import { ConfigProvider } from '@arco-design/web-react';

<ConfigProvider size="large">
  {/* 即使 body 是暗黑模式，这里的组件也会显示为亮色 */}
  <div>
    <Button>不受影响的按钮</Button>
  </div>
</ConfigProvider>
```

### Q6：样式覆盖优先级问题？

Arco Design 的样式使用 CSS 变量，可以通过更高优先级的 CSS 规则覆盖：

```css
/* 使用 !important 强制覆盖 */
.arco-btn-primary {
  background-color: #f85959 !important;
}
```

---

## 十一、浏览器兼容性

| 浏览器 | 最低版本 |
|--------|----------|
| IE / Edge | Edge 16+ |
| Firefox | 31+ |
| Chrome | 49+ |
| Safari | 31+ |
| Opera | 36+ |
| Electron | 最近两个版本 |

> 注意：组件库基于 CSS Custom Properties 实现，不支持 IE 浏览器。如需兼容 IE，需要使用 postcss-custom-properties 插件将 CSS 变量转换为静态值。
