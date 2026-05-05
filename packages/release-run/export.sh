#!/usr/bin/env bash

# 从.env文件导出TAURI签名密钥环境变量
# 用法: 
#   source ./export.sh    # 在当前shell中设置环境变量
#   . ./export.sh         # 同上
#   ./export.sh           # 直接设置环境变量（子shell中）
#   ./export.sh --print   # 输出export命令，可用于eval

# 获取脚本所在目录（兼容bash和zsh）
if [ -n "$BASH_VERSION" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [ -n "$ZSH_VERSION" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${(%):-%x}")" && pwd)"
else
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "错误: 未找到.env文件: $ENV_FILE" >&2
    echo "提示: 确保.env文件存在于脚本同一目录: $SCRIPT_DIR/" >&2
    return 1 2>/dev/null || exit 1
fi

# 检查是否输出模式
PRINT_MODE=false
if [[ "$1" == "--print" ]]; then
    PRINT_MODE=true
fi

# 检测是否被source执行（简化版）
is_sourced() {
    [[ "$0" != "${BASH_SOURCE[0]}" ]]
}

# 使用grep提取变量值
while IFS= read -r line; do
    # 跳过注释和空行
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    
    # 分割键值
    key="${line%%=*}"
    value="${line#*=}"
    
    # 去除可能的空格
    key="${key// /}"
    value="${value# }"
    
    # 只导出TAURI相关的变量
    if [[ "$key" == "TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ]] || [[ "$key" == "TAURI_SIGNING_PRIVATE_KEY" ]]; then
        if is_sourced || [[ "$PRINT_MODE" == false ]]; then
            # 被source执行或直接执行：设置环境变量
            export "$key"="$value"
            echo "已导出: $key"
        else
            # 输出模式：输出带转义的export命令
            printf 'export %s="%s"\n' "$key" "$(echo "$value" | sed 's/"/\\"/g')"
        fi
    fi
done < <(grep -E "^(TAURI_SIGNING_PRIVATE_KEY_PASSWORD|TAURI_SIGNING_PRIVATE_KEY)=" "$ENV_FILE")

if is_sourced || [[ "$PRINT_MODE" == false ]]; then
    echo "🎉 TAURI签名密钥环境变量已设置完成"
fi