# Auto Patching Ansible

## Sanity Reboot

Run the sanity reboot playbook:

```bash
ansible-playbook playbooks/sanity-reboot.yml \
  -e "lambda_sanity_reboot_status_url=https://qugbbgezz4.execute-api.ap-south-1.amazonaws.com/sanity-reboot-status"
```

## Patch

Run the patch playbook:

```bash
ansible-playbook patch.yml \
  -e "lambda_patch_status_url=https://qugbbgezz4.execute-api.ap-south-1.amazonaws.com/patch-status"
```
