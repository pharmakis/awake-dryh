export function autoResizeTextareas(
  root
) {
  const textareas =
    root.querySelectorAll(
      "textarea"
    );

  for (const textarea of textareas) {
    const resize = () => {
      textarea.style.height =
        "auto";

      textarea.style.height =
        `${textarea.scrollHeight}px`;
    };

    resize();

    textarea.addEventListener(
      "input",
      resize
    );
  }
}