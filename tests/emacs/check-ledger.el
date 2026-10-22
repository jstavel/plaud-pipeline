;;; check-ledger.el --- batch org validity check for SC-006 -*-
;;
;; Usage: emacs --batch -Q -l tests/emacs/check-ledger.el -- <ledger.org>
;;
;; Loads the ledger, lets org-mode derive its todo keywords from the file's
;; #+TODO: line (populating org-todo-kwd-alist), then asserts every heading's
;; todo keyword is one of the five states declared for C2. Exits 0 on pass,
;; non-zero on any foreign state or parse failure. Test-only: production code
;; never runs Emacs (constitution).

(require 'org)

(setq check-ledger--allowed '("TODO" "INGEST" "REJECT" "IGNORE" "WAIVED"))

(defun check-ledger--run (file)
  (unless (file-readable-p file)
    (message "FAIL: file not readable: %s" file)
    (kill-emacs 2))
  (with-current-buffer (find-file-noselect file)
    (org-mode)
    (org-set-regexps-and-options)
    (let ((alist org-todo-kwd-alist)
          (bad '())
          (count 0))
      (unless alist
        (message "FAIL: no org-todo-kwd-alist derived from #+TODO: in %s" file)
        (kill-emacs 3))
      (org-element-map (org-element-parse-buffer) 'headline
        (lambda (h)
          (let* ((kw-raw (org-element-property :todo-keyword h))
                 (kw (if (stringp kw-raw)
                         kw-raw
                       (and kw-raw (org-element-property :raw-value kw-raw)))))
            (setq count (1+ count))
            (unless (and kw (member kw check-ledger--allowed))
              (push (cons (org-element-property :title h) kw) bad)))))
      (when bad
        (message "FAIL: foreign todo keywords: %S" bad)
        (kill-emacs 5))
      (message "OK: %d headings, all states in %s" count check-ledger--allowed)
      (kill-emacs 0))))

(check-ledger--run (car (cdr (member "--" command-line-args))))