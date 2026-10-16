// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Adapters, BlobLike } from "../../src/core/index.js";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { FileWidget, ImageWidget } from "../../src/html/index.js";
import { ERROR, fieldProps, MODES } from "./helpers.js";

const urlInput = () => document.getElementById("f") as HTMLInputElement;
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]');
const pick = (name: string) => {
  const file = new File(["x"], name, { type: "image/png" });
  fireEvent.change(fileInput() as HTMLInputElement, { target: { files: [file] } });
  return file;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe.each([
  ["image", ImageWidget],
  ["file", FileWidget],
] as const)("%s", (kind, Widget) => {
  it("无 upload 适配器时只有 URL 输入, 显示与写回 URL", () => {
    const props = fieldProps<string>({ value: "https://example.com/a.png" });
    render(<Widget {...props} />);
    expect(urlInput().type).toBe("url");
    expect(urlInput().value).toBe("https://example.com/a.png");
    expect(fileInput()).toBeNull();
    fireEvent.change(urlInput(), { target: { value: "https://example.com/b.png" } });
    expect(props.onChange).toHaveBeenLastCalledWith("https://example.com/b.png");
    fireEvent.change(urlInput(), { target: { value: "" } });
    expect(props.onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("有 upload 时增加文件选择, 上传后写回返回的 URL", async () => {
    const upload = vi.fn(async (file: BlobLike) => `https://cdn.example.com/${file.name ?? ""}`);
    const props = fieldProps<string>({ adapters: { upload } });
    render(<Widget {...props} />);
    expect(fileInput()).not.toBeNull();
    const file = pick("a.png");
    expect(upload).toHaveBeenCalledWith(file, { dataPath: "/f", schema: { type: "string" } });
    await waitFor(() => expect(props.onChange).toHaveBeenLastCalledWith("https://cdn.example.com/a.png"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("上传按钮打开文件选择, 文件选择框本身隐藏", () => {
    render(<Widget {...fieldProps<string>({ adapters: { upload: async () => "" } })} />);
    const button = screen.getByRole("button", { name: kind === "image" ? "上传图片" : "上传文件" }) as HTMLButtonElement;
    const click = vi.spyOn(fileInput() as HTMLInputElement, "click");
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
    expect(fileInput()?.hidden).toBe(true);
  });

  it("上传中禁用上传按钮", () => {
    const pending = deferred<string>();
    render(<Widget {...fieldProps<string>({ adapters: { upload: () => pending.promise } })} />);
    pick("a.png");
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("上传中显示状态并禁用文件选择, 失败时显示可读提示且不写回", async () => {
    const pending = deferred<string>();
    const props = fieldProps<string>({ adapters: { upload: () => pending.promise } });
    render(<Widget {...props} />);
    pick("a.png");
    expect(screen.getByRole("status").textContent).toBe("上传中…");
    expect(fileInput()?.disabled).toBe(true);
    await act(async () => pending.reject(new Error("network down: 10.0.0.1")));
    expect(screen.getByRole("status").textContent).toBe("上传失败, 请重试");
    expect(screen.getByRole("status").textContent).not.toContain("10.0.0.1");
    expect(urlInput().getAttribute("aria-describedby")).toBe("f-upload-status");
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("upload 同步抛错时同样显示失败提示", async () => {
    const props = fieldProps<string>({
      adapters: {
        upload: () => {
          throw new Error("boom");
        },
      },
    });
    render(<Widget {...props} />);
    pick("a.png");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("上传失败, 请重试"));
  });

  it("前一次上传未完成又选择文件时, 只写回最后一次上传的结果", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const upload = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const adapters: Adapters<ReactNode> = { upload };
    const props = fieldProps<string>({ adapters });
    render(<Widget {...props} />);
    pick("a.png");
    pick("b.png");
    expect(upload).toHaveBeenCalledTimes(2);
    await act(async () => second.resolve("https://cdn/b"));
    await act(async () => first.resolve("https://cdn/a"));
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenLastCalledWith("https://cdn/b");
  });

  it("卸载后上传完成不写回", async () => {
    const pending = deferred<string>();
    const props = fieldProps<string>({ adapters: { upload: () => pending.promise } });
    const { unmount } = render(<Widget {...props} />);
    pick("a.png");
    unmount();
    await act(async () => pending.resolve("https://cdn/late"));
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it.each(MODES)("mode=%s", (mode) => {
    render(<Widget {...fieldProps<string>({ mode, adapters: { upload: async () => "" } })} />);
    expect(urlInput().readOnly).toBe(mode === "view");
    expect(urlInput().disabled).toBe(mode === "disabled");
    if (mode === "view") expect(fileInput()).toBeNull();
    else expect(fileInput()?.disabled).toBe(mode === "disabled");
  });

  it("有错误时 aria-invalid", () => {
    render(<Widget {...fieldProps<string>({ errors: [ERROR] })} />);
    expect(urlInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("文件选择的 accept 取 contentMediaType", () => {
    render(<Widget {...fieldProps<string>({ schema: { type: "string", contentMediaType: "application/pdf" }, adapters: { upload: async () => "" } })} />);
    expect(fileInput()?.accept).toBe("application/pdf");
  });

  it(kind === "image" ? "有值时显示 img 预览" : "不显示图片预览", () => {
    const { rerender } = render(<Widget {...fieldProps<string>({ value: "https://example.com/a.png" })} />);
    const img = document.querySelector("img");
    if (kind === "image") {
      expect(img?.getAttribute("src")).toBe("https://example.com/a.png");
      rerender(<Widget {...fieldProps<string>()} />);
      expect(document.querySelector("img")).toBeNull();
    } else {
      expect(img).toBeNull();
    }
  });
});

describe("image 的默认 accept", () => {
  it("没有 contentMediaType 时为 image/*", () => {
    render(<ImageWidget {...fieldProps<string>({ adapters: { upload: async () => "" } })} />);
    expect(fileInput()?.accept).toBe("image/*");
  });
});
